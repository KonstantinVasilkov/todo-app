from collections.abc import Awaitable, Callable
from uuid import UUID, uuid4

import httpx
import pytest
from fastapi import FastAPI

from app.repositories.category import CategoryRepository
from tests.factories import AuthedUser

MakeCategory = Callable[[AuthedUser, str], Awaitable[UUID]]

NOTE_KEYS = {"id", "title", "body", "due", "status", "categories", "created_at", "updated_at"}


async def post_note(client: httpx.AsyncClient, user: AuthedUser, **payload: object) -> dict:
    response = await client.post("/notes", json=payload, headers=user.headers)
    assert response.status_code == 201, response.text
    return response.json()


async def test_create_defaults(client: httpx.AsyncClient, user: AuthedUser):
    response = await client.post("/notes", json={"title": "Buy milk"}, headers=user.headers)
    assert response.status_code == 201
    body = response.json()
    assert set(body) == NOTE_KEYS
    assert body["status"] == "todo"
    assert body["body"] is None
    assert body["due"] is None
    assert body["categories"] == []
    assert body["created_at"] == body["updated_at"]


async def test_create_explicit_null_status(client: httpx.AsyncClient, user: AuthedUser):
    note = await post_note(client, user, title="t", status=None)
    assert note["status"] is None


async def test_due_normalized_to_utc(client: httpx.AsyncClient, user: AuthedUser):
    note = await post_note(client, user, title="t", due="2026-10-21T15:00:00+03:00")
    assert note["due"] == "2026-10-21T12:00:00Z"
    got = await client.get(f"/notes/{note['id']}", headers=user.headers)
    assert got.json()["due"] == "2026-10-21T12:00:00Z"
    patched = await client.patch(
        f"/notes/{note['id']}", json={"due": "2026-10-22T15:00:00+03:00"}, headers=user.headers
    )
    assert patched.json()["due"] == "2026-10-22T12:00:00Z"


async def test_create_with_categories(
    client: httpx.AsyncClient, user: AuthedUser, make_category: MakeCategory
):
    cb = await make_category(user, "b")
    ca = await make_category(user, "a")
    note = await post_note(client, user, title="t", category_ids=[str(cb), str(ca)])
    assert [c["name"] for c in note["categories"]] == ["a", "b"]
    assert set(note["categories"][0]) == {"id", "name", "created_at", "updated_at"}


async def test_duplicate_category_ids_deduplicated(
    client: httpx.AsyncClient, user: AuthedUser, make_category: MakeCategory
):
    c1 = await make_category(user, "a")
    note = await post_note(client, user, title="t", category_ids=[str(c1), str(c1)])
    assert [c["name"] for c in note["categories"]] == ["a"]


@pytest.mark.parametrize("kind", ["other_user", "unknown", "deleted_own"])
async def test_invalid_category_ids(
    kind: str,
    client: httpx.AsyncClient,
    app: FastAPI,
    user: AuthedUser,
    other_user: AuthedUser,
    make_category: MakeCategory,
):
    if kind == "other_user":
        cid = await make_category(other_user, "x")
    elif kind == "unknown":
        cid = uuid4()
    else:
        cid = await make_category(user, "x")
        async with app.state.session_factory() as s, s.begin():
            repo = CategoryRepository(s, actor_id=user.id)
            category = await repo.get(cid)
            assert category is not None
            await repo.soft_delete(category)

    response = await client.post(
        "/notes", json={"title": "t", "category_ids": [str(cid)]}, headers=user.headers
    )
    assert response.status_code == 422
    detail = response.json()["detail"][0]
    assert detail["loc"] == ["body", "category_ids"]
    assert detail["type"] == "invalid_reference"

    note = await post_note(client, user, title="t")
    response = await client.patch(
        f"/notes/{note['id']}", json={"category_ids": [str(cid)]}, headers=user.headers
    )
    assert response.status_code == 422
    detail = response.json()["detail"][0]
    assert detail["loc"] == ["body", "category_ids"]
    assert detail["type"] == "invalid_reference"


async def test_get_patch_delete_own(client: httpx.AsyncClient, user: AuthedUser):
    note = await post_note(client, user, title="t")
    url = f"/notes/{note['id']}"
    assert (await client.get(url, headers=user.headers)).status_code == 200
    deleted = await client.delete(url, headers=user.headers)
    assert deleted.status_code == 204
    assert deleted.content == b""
    assert (await client.get(url, headers=user.headers)).status_code == 404
    assert (await client.patch(url, json={"title": "x"}, headers=user.headers)).status_code == 404
    assert (await client.delete(url, headers=user.headers)).status_code == 404
    listing = (await client.get("/notes", headers=user.headers)).json()
    assert listing["items"] == []
    assert listing["total"] == 0


async def test_isolation(client: httpx.AsyncClient, user: AuthedUser, other_user: AuthedUser):
    note = await post_note(client, other_user, title="secret")
    url = f"/notes/{note['id']}"
    assert (await client.get(url, headers=user.headers)).status_code == 404
    assert (await client.patch(url, json={"title": "x"}, headers=user.headers)).status_code == 404
    assert (await client.delete(url, headers=user.headers)).status_code == 404
    assert (await client.get(url, headers=other_user.headers)).json()["title"] == "secret"


async def test_patch_only_sent_fields(
    client: httpx.AsyncClient, user: AuthedUser, make_category: MakeCategory
):
    c1 = await make_category(user, "a")
    note = await post_note(
        client,
        user,
        title="Old",
        body="text",
        due="2026-10-21T12:00:00Z",
        status="in_progress",
        category_ids=[str(c1)],
    )
    response = await client.patch(
        f"/notes/{note['id']}", json={"title": "New"}, headers=user.headers
    )
    assert response.status_code == 200
    patched = response.json()
    assert patched["title"] == "New"
    for key in ("body", "due", "status", "categories", "created_at"):
        assert patched[key] == note[key]
    assert patched["updated_at"] > patched["created_at"]


async def test_patch_null_clears(client: httpx.AsyncClient, user: AuthedUser):
    note = await post_note(
        client, user, title="Keep", body="x", due="2026-10-21T12:00:00Z", status="done"
    )
    response = await client.patch(
        f"/notes/{note['id']}",
        json={"body": None, "due": None, "status": None},
        headers=user.headers,
    )
    assert response.status_code == 200
    patched = response.json()
    assert patched["body"] is None
    assert patched["due"] is None
    assert patched["status"] is None
    assert patched["title"] == "Keep"


async def test_patch_replaces_categories(
    client: httpx.AsyncClient, user: AuthedUser, make_category: MakeCategory
):
    c1 = await make_category(user, "one")
    c2 = await make_category(user, "two")
    note = await post_note(client, user, title="t", category_ids=[str(c1)])
    url = f"/notes/{note['id']}"
    response = await client.patch(url, json={"category_ids": [str(c2)]}, headers=user.headers)
    assert [c["name"] for c in response.json()["categories"]] == ["two"]
    assert response.json()["updated_at"] > note["updated_at"]
    response = await client.patch(url, json={"category_ids": []}, headers=user.headers)
    assert response.json()["categories"] == []
    got = await client.get(url, headers=user.headers)
    assert got.json()["categories"] == []


@pytest.mark.parametrize("payload", [{"title": None}, {"category_ids": None}, {"status": "bad"}])
async def test_patch_rejects_null_required(
    payload: dict, client: httpx.AsyncClient, user: AuthedUser
):
    note = await post_note(client, user, title="t")
    response = await client.patch(f"/notes/{note['id']}", json=payload, headers=user.headers)
    assert response.status_code == 422
    if "status" not in payload:
        field = next(iter(payload))
        assert response.json()["detail"][0]["loc"] == ["body", field]


@pytest.mark.parametrize("title", ["", "   ", "x" * 201])
async def test_title_validation(title: str, client: httpx.AsyncClient, user: AuthedUser):
    response = await client.post("/notes", json={"title": title}, headers=user.headers)
    assert response.status_code == 422


async def test_requires_auth(client: httpx.AsyncClient):
    note_id = uuid4()
    responses = [
        await client.post("/notes", json={"title": "t"}),
        await client.get("/notes"),
        await client.get(f"/notes/{note_id}"),
        await client.patch(f"/notes/{note_id}", json={"title": "t"}),
        await client.delete(f"/notes/{note_id}"),
    ]
    assert [r.status_code for r in responses] == [401] * 5


@pytest.mark.parametrize("due", ["0001-01-01T00:00:00+03:00", "9999-12-31T23:00:00-03:00"])
async def test_due_out_of_range(due: str, client: httpx.AsyncClient, user: AuthedUser):
    response = await client.post("/notes", json={"title": "t", "due": due}, headers=user.headers)
    assert response.status_code == 422

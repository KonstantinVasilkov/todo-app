from collections.abc import Awaitable, Callable
from uuid import UUID

import httpx
import pytest

from tests.factories import AuthedUser

MakeCategory = Callable[[AuthedUser, str], Awaitable[UUID]]


async def make_note(
    client: httpx.AsyncClient,
    user: AuthedUser,
    title: str,
    *,
    due: str | None = None,
    status: str | None = "todo",
    category_ids: list[UUID] | None = None,
) -> dict:
    response = await client.post(
        "/notes",
        json={
            "title": title,
            "due": due,
            "status": status,
            "category_ids": [str(c) for c in category_ids or []],
        },
        headers=user.headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


async def titles(client: httpx.AsyncClient, user: AuthedUser, query: str = "") -> set[str]:
    response = await client.get(f"/notes?{query}", headers=user.headers)
    assert response.status_code == 200, response.text
    return {n["title"] for n in response.json()["items"]}


async def test_filter_status(client: httpx.AsyncClient, user: AuthedUser):
    await make_note(client, user, "todo", status="todo")
    await make_note(client, user, "prog", status="in_progress")
    await make_note(client, user, "done", status="done")
    await make_note(client, user, "null", status=None)

    assert await titles(client, user, "status=todo&status=done") == {"todo", "done"}
    assert await titles(client, user) == {"todo", "prog", "done", "null"}
    assert await titles(client, user, "status=none") == {"null"}
    assert await titles(client, user, "status=todo&status=none") == {"todo", "null"}


async def test_filter_category_any_of(
    client: httpx.AsyncClient, user: AuthedUser, make_category: MakeCategory
):
    c1 = await make_category(user, "c1")
    c2 = await make_category(user, "c2")
    await make_note(client, user, "n1", category_ids=[c1])
    await make_note(client, user, "n2", category_ids=[c2])
    await make_note(client, user, "n3", category_ids=[c1, c2])
    await make_note(client, user, "n4")

    response = await client.get(f"/notes?category_id={c1}&category_id={c2}", headers=user.headers)
    body = response.json()
    assert sorted(n["title"] for n in body["items"]) == ["n1", "n2", "n3"]
    assert body["total"] == 3


async def test_filter_due_range_inclusive(client: httpx.AsyncClient, user: AuthedUser):
    await make_note(client, user, "from", due="2026-10-10T12:00:00Z")
    await make_note(client, user, "to", due="2026-10-20T12:00:00Z")
    await make_note(client, user, "out", due="2026-10-30T12:00:00Z")
    await make_note(client, user, "nodue")

    query = "due_from=2026-10-10T12:00:00Z&due_to=2026-10-20T12:00:00Z"
    assert await titles(client, user, query) == {"from", "to"}
    assert await titles(client, user, "due_from=2026-10-10T15:00:00%2B03:00") == {
        "from",
        "to",
        "out",
    }
    assert await titles(client, user, "due_to=2026-10-10T14:59:59%2B03:00") == set()


async def test_filter_has_due(client: httpx.AsyncClient, user: AuthedUser):
    await make_note(client, user, "due", due="2026-10-10T12:00:00Z")
    await make_note(client, user, "nodue")

    assert await titles(client, user, "has_due=true") == {"due"}
    assert await titles(client, user, "has_due=false") == {"nodue"}
    response = await client.get(
        "/notes?has_due=false&due_from=2026-01-01T00:00:00Z", headers=user.headers
    )
    assert response.status_code == 200
    assert response.json()["items"] == []
    assert response.json()["total"] == 0


async def test_filters_combined(
    client: httpx.AsyncClient, user: AuthedUser, make_category: MakeCategory
):
    c1 = await make_category(user, "c1")
    await make_note(
        client, user, "hit", status="todo", due="2026-10-10T00:00:00Z", category_ids=[c1]
    )
    await make_note(
        client, user, "wrong-status", status="done", due="2026-10-10T00:00:00Z", category_ids=[c1]
    )
    await make_note(client, user, "wrong-cat", status="todo", due="2026-10-10T00:00:00Z")
    await make_note(
        client, user, "late", status="todo", due="2026-12-10T00:00:00Z", category_ids=[c1]
    )

    query = f"status=todo&category_id={c1}&due_to=2026-11-01T00:00:00Z"
    assert await titles(client, user, query) == {"hit"}


async def test_pagination(client: httpx.AsyncClient, user: AuthedUser):
    for i in range(5):
        await make_note(client, user, f"n{i}", due=f"2026-10-0{i + 1}T00:00:00Z")

    body = (await client.get("/notes?limit=2&offset=2", headers=user.headers)).json()
    assert [n["title"] for n in body["items"]] == ["n2", "n3"]
    assert (body["total"], body["limit"], body["offset"]) == (5, 2, 2)

    body = (await client.get("/notes?offset=10", headers=user.headers)).json()
    assert body["items"] == []
    assert body["total"] == 5

    body = (await client.get("/notes", headers=user.headers)).json()
    assert (body["limit"], body["offset"]) == (20, 0)


@pytest.mark.parametrize(
    "query", ["limit=0", "limit=101", "offset=-1", "offset=9223372036854775808", "status=bad"]
)
async def test_pagination_validation(query: str, client: httpx.AsyncClient, user: AuthedUser):
    response = await client.get(f"/notes?{query}", headers=user.headers)
    assert response.status_code == 422


async def test_sort_order(client: httpx.AsyncClient, user: AuthedUser):
    await make_note(client, user, "10-03", due="2026-10-03T00:00:00Z")
    await make_note(client, user, "10-01", due="2026-10-01T00:00:00Z")
    await make_note(client, user, "nodue-earlier")
    await make_note(client, user, "nodue-later")

    items = (await client.get("/notes", headers=user.headers)).json()["items"]
    assert [n["title"] for n in items] == ["10-01", "10-03", "nodue-later", "nodue-earlier"]


async def test_list_isolation_and_soft_delete(
    client: httpx.AsyncClient, user: AuthedUser, other_user: AuthedUser
):
    await make_note(client, user, "mine")
    gone = await make_note(client, user, "gone")
    await make_note(client, other_user, "theirs")
    await client.delete(f"/notes/{gone['id']}", headers=user.headers)

    body = (await client.get("/notes", headers=user.headers)).json()
    assert [n["title"] for n in body["items"]] == ["mine"]
    assert body["total"] == 1


async def test_due_filter_out_of_range(client: httpx.AsyncClient, user: AuthedUser):
    response = await client.get(
        "/notes", params={"due_from": "0001-01-01T00:00:00+03:00"}, headers=user.headers
    )
    assert response.status_code == 422

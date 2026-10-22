import asyncio
from collections.abc import Awaitable, Callable
from uuid import UUID, uuid4

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.exceptions import Conflict
from app.repositories.category import CategoryRepository
from app.repositories.user import UserRepository
from app.schemas.category import CategoryCreate, CategoryRead
from app.schemas.user import UserRead
from app.services.category import CategoryService
from tests.factories import AuthedUser

CONFLICT = [{"loc": ["body", "name"], "msg": "Category name already taken", "type": "conflict"}]


async def create(client: httpx.AsyncClient, who: AuthedUser, name: str) -> httpx.Response:
    return await client.post("/categories", json={"name": name}, headers=who.headers)


async def test_crud(client: httpx.AsyncClient, user: AuthedUser):
    resp = await create(client, user, "Work")
    assert resp.status_code == 201
    body = resp.json()
    assert set(body) == {"id", "name", "created_at", "updated_at"}

    resp = await client.patch(
        f"/categories/{body['id']}", json={"name": "Job"}, headers=user.headers
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Job"
    assert resp.json()["updated_at"] >= resp.json()["created_at"]

    resp = await client.delete(f"/categories/{body['id']}", headers=user.headers)
    assert resp.status_code == 204
    assert resp.content == b""

    resp = await client.get("/categories", headers=user.headers)
    assert resp.json() == []


async def test_list_sorted_by_name(client: httpx.AsyncClient, user: AuthedUser):
    for name in ("b", "a", "c"):
        await create(client, user, name)
    resp = await client.get("/categories", headers=user.headers)
    assert [c["name"] for c in resp.json()] == ["a", "b", "c"]


async def test_duplicate_name_conflict(client: httpx.AsyncClient, user: AuthedUser):
    await create(client, user, "Work")
    resp = await create(client, user, "Work")
    assert resp.status_code == 409
    assert resp.json()["detail"] == CONFLICT

    other = (await create(client, user, "Home")).json()
    resp = await client.patch(
        f"/categories/{other['id']}", json={"name": "Work"}, headers=user.headers
    )
    assert resp.status_code == 409
    assert resp.json()["detail"] == CONFLICT


async def test_rename_to_same_name(client: httpx.AsyncClient, user: AuthedUser):
    cat = (await create(client, user, "Work")).json()
    resp = await client.patch(
        f"/categories/{cat['id']}", json={"name": "Work"}, headers=user.headers
    )
    assert resp.status_code == 200


async def test_same_name_other_user(
    client: httpx.AsyncClient, user: AuthedUser, other_user: AuthedUser
):
    await create(client, user, "Work")
    assert (await create(client, other_user, "Work")).status_code == 201


async def test_name_reusable_after_delete(client: httpx.AsyncClient, user: AuthedUser):
    cat = (await create(client, user, "Work")).json()
    await client.delete(f"/categories/{cat['id']}", headers=user.headers)
    assert (await create(client, user, "Work")).status_code == 201


@pytest.mark.parametrize("name", ["", "   ", "x" * 51])
async def test_name_validation(client: httpx.AsyncClient, user: AuthedUser, name: str):
    assert (await create(client, user, name)).status_code == 422
    cat = (await create(client, user, "ok")).json()
    resp = await client.patch(f"/categories/{cat['id']}", json={"name": name}, headers=user.headers)
    assert resp.status_code == 422


async def test_isolation(
    client: httpx.AsyncClient,
    user: AuthedUser,
    other_user: AuthedUser,
    make_category: Callable[[AuthedUser, str], Awaitable[UUID]],
):
    foreign = await make_category(other_user, "Secret")
    resp = await client.patch(f"/categories/{foreign}", json={"name": "x"}, headers=user.headers)
    assert resp.status_code == 404
    resp = await client.delete(f"/categories/{foreign}", headers=user.headers)
    assert resp.status_code == 404
    resp = await client.get("/categories", headers=user.headers)
    assert resp.json() == []


async def test_deleted_category_404(client: httpx.AsyncClient, user: AuthedUser):
    cat = (await create(client, user, "Work")).json()
    await client.delete(f"/categories/{cat['id']}", headers=user.headers)
    resp = await client.patch(f"/categories/{cat['id']}", json={"name": "x"}, headers=user.headers)
    assert resp.status_code == 404
    resp = await client.delete(f"/categories/{cat['id']}", headers=user.headers)
    assert resp.status_code == 404


async def test_requires_auth(client: httpx.AsyncClient):
    cid = uuid4()
    assert (await client.post("/categories", json={"name": "a"})).status_code == 401
    assert (await client.get("/categories")).status_code == 401
    assert (await client.patch(f"/categories/{cid}", json={"name": "a"})).status_code == 401
    assert (await client.delete(f"/categories/{cid}")).status_code == 401


async def test_concurrent_create_same_name(
    session_factory: async_sessionmaker[AsyncSession], user: AuthedUser
):
    async with session_factory() as session, session.begin():
        orm_user = await UserRepository(session, actor_id=None).get(user.id)
        user_read = UserRead.model_validate(orm_user)
    service = CategoryService(session_factory, user_read)
    data = CategoryCreate(name="dup")
    results = await asyncio.gather(
        service.create(data), service.create(data), return_exceptions=True
    )
    created = [r for r in results if isinstance(r, CategoryRead)]
    conflicts = [r for r in results if isinstance(r, Conflict)]
    assert len(created) == 1
    assert len(conflicts) == 1
    assert conflicts[0].field == "name"


@pytest.mark.parametrize(
    "first, second",
    [("straße", "STRASSE"), ("σοφια", "ΣΟΦΙΑ"), ("ä", "Ä"), ("work", "Work")],
)
async def test_duplicate_name_case_insensitive(
    client: httpx.AsyncClient, user: AuthedUser, first: str, second: str
):
    assert (await create(client, user, first)).status_code == 201
    resp = await create(client, user, second)
    assert resp.status_code == 409
    assert resp.json()["detail"] == CONFLICT

    other = (await create(client, user, "Home")).json()
    resp = await client.patch(
        f"/categories/{other['id']}", json={"name": second}, headers=user.headers
    )
    assert resp.status_code == 409
    assert resp.json()["detail"] == CONFLICT


async def test_rename_case_only(client: httpx.AsyncClient, user: AuthedUser):
    cat = (await create(client, user, "work")).json()
    resp = await client.patch(
        f"/categories/{cat['id']}", json={"name": "Work"}, headers=user.headers
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Work"


async def test_list_sorted_case_insensitive(client: httpx.AsyncClient, user: AuthedUser):
    for name in ("banana", "Apple", "cherry", "Σοφια", "αθηνα"):
        await create(client, user, name)
    resp = await client.get("/categories", headers=user.headers)
    assert [c["name"] for c in resp.json()] == ["Apple", "banana", "cherry", "αθηνα", "Σοφια"]


async def test_name_key_not_exposed(client: httpx.AsyncClient, user: AuthedUser):
    expected = {"id", "name", "created_at", "updated_at"}
    created = await create(client, user, "Work")
    assert set(created.json()) == expected
    listed = await client.get("/categories", headers=user.headers)
    assert set(listed.json()[0]) == expected


@pytest.fixture
def blind_precheck(monkeypatch: pytest.MonkeyPatch) -> None:
    original = CategoryRepository.get_or_none

    async def no_match(self, *where, **eq):
        if "name_key" in eq:
            return None
        return await original(self, *where, **eq)

    monkeypatch.setattr(CategoryRepository, "get_or_none", no_match)


@pytest.mark.usefixtures("blind_precheck")
async def test_create_integrity_error_becomes_conflict(client: httpx.AsyncClient, user: AuthedUser):
    first = (await create(client, user, "Σοφια")).json()
    resp = await create(client, user, "σοφια")
    assert resp.status_code == 409
    assert resp.json()["detail"][0]["loc"] == ["body", "name"]
    listed = (await client.get("/categories", headers=user.headers)).json()
    assert [(c["id"], c["name"]) for c in listed] == [(first["id"], "Σοφια")]


@pytest.mark.usefixtures("blind_precheck")
async def test_rename_integrity_error_becomes_conflict(client: httpx.AsyncClient, user: AuthedUser):
    await create(client, user, "a")
    other = (await create(client, user, "b")).json()
    resp = await client.patch(
        f"/categories/{other['id']}", json={"name": "A"}, headers=user.headers
    )
    assert resp.status_code == 409
    assert resp.json()["detail"][0]["loc"] == ["body", "name"]
    listed = (await client.get("/categories", headers=user.headers)).json()
    assert [c["name"] for c in listed] == ["a", "b"]

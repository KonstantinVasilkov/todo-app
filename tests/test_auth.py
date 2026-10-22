import asyncio
from collections.abc import Awaitable, Callable
from uuid import UUID

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import Settings
from app.exceptions import Conflict
from app.repositories.user import UserRepository
from app.schemas.auth import RegisterRequest
from app.schemas.user import UserRead
from app.services.auth import AuthService, _conflict_field
from tests.factories import AuthedUser

USER_KEYS = {"id", "username", "email", "created_at"}
PAYLOAD = {"username": "alice", "email": "alice@example.com", "password": "password123"}


async def test_register(client: httpx.AsyncClient, app: FastAPI):
    payload = {**PAYLOAD, "email": "Alice@Example.COM"}
    response = await client.post("/auth/register", json=payload)

    assert response.status_code == 201
    body = response.json()
    assert set(body) == USER_KEYS
    assert body["email"] == "alice@example.com"
    async with app.state.session_factory() as session:
        row = await UserRepository(session, actor_id=None).get(UUID(body["id"]))
    assert row is not None
    assert row.created_by == row.updated_by == row.id
    assert row.status is None
    assert row.password_hash != payload["password"]


async def test_register_duplicate_username(client: httpx.AsyncClient):
    await client.post("/auth/register", json=PAYLOAD)
    response = await client.post("/auth/register", json={**PAYLOAD, "email": "other@example.com"})

    assert response.status_code == 409
    assert response.json()["detail"] == [
        {"loc": ["body", "username"], "msg": "Username already taken", "type": "conflict"}
    ]


async def test_register_duplicate_email_case_insensitive(client: httpx.AsyncClient):
    await client.post("/auth/register", json=PAYLOAD)
    response = await client.post(
        "/auth/register", json={**PAYLOAD, "username": "bob", "email": "ALICE@example.com"}
    )

    assert response.status_code == 409
    assert response.json()["detail"][0]["loc"] == ["body", "email"]


@pytest.mark.parametrize(
    "override",
    [
        {"username": "ab"},
        {"username": "a" * 51},
        {"username": "bad name!"},
        {"password": "short77"},
        {"email": "not-an-email"},
    ],
)
async def test_register_validation(client: httpx.AsyncClient, override: dict[str, str]):
    response = await client.post("/auth/register", json={**PAYLOAD, **override})

    assert response.status_code == 422


async def test_username_reusable_after_soft_delete(
    client: httpx.AsyncClient,
    make_user: Callable[..., Awaitable[AuthedUser]],
    delete_user: Callable[[AuthedUser], Awaitable[None]],
):
    old = await make_user("alice", email="alice@example.com")
    await delete_user(old)

    response = await client.post("/auth/register", json=PAYLOAD)

    assert response.status_code == 201


async def test_login(client: httpx.AsyncClient, user: AuthedUser):
    response = await client.post(
        "/auth/login", data={"username": user.username, "password": user.password}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    me = await client.get("/users/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    assert me.json()["id"] == str(user.id)


@pytest.mark.parametrize("case", ["wrong_password", "unknown_user", "deleted_user"])
async def test_login_rejected(
    client: httpx.AsyncClient,
    user: AuthedUser,
    delete_user: Callable[[AuthedUser], Awaitable[None]],
    case: str,
):
    form = {"username": user.username, "password": user.password}
    if case == "wrong_password":
        form["password"] = "wrong-password"
    elif case == "unknown_user":
        form["username"] = "nobody"
    else:
        await delete_user(user)

    response = await client.post("/auth/login", data=form)

    assert response.status_code == 401


async def test_users_me(client: httpx.AsyncClient, user: AuthedUser):
    response = await client.get("/users/me", headers=user.headers)
    assert response.status_code == 200
    assert set(response.json()) == USER_KEYS

    assert (await client.get("/users/me")).status_code == 401


async def test_concurrent_register_same_username(
    session_factory: async_sessionmaker[AsyncSession], settings: Settings
):
    service = AuthService(session_factory, settings)
    data = RegisterRequest(**PAYLOAD)
    other = RegisterRequest(**{**PAYLOAD, "email": "alice2@example.com"})
    results = await asyncio.gather(
        service.register(data), service.register(other), return_exceptions=True
    )
    users = [r for r in results if isinstance(r, UserRead)]
    conflicts = [r for r in results if isinstance(r, Conflict)]
    assert len(users) == 1
    assert len(conflicts) == 1
    assert conflicts[0].field == "username"


async def test_concurrent_register_same_email(
    session_factory: async_sessionmaker[AsyncSession], settings: Settings
):
    service = AuthService(session_factory, settings)
    first = RegisterRequest(**PAYLOAD)
    second = RegisterRequest(**{**PAYLOAD, "username": "alice2"})
    results = await asyncio.gather(
        service.register(first), service.register(second), return_exceptions=True
    )
    users = [r for r in results if isinstance(r, UserRead)]
    conflicts = [r for r in results if isinstance(r, Conflict)]
    assert len(users) == 1
    assert len(conflicts) == 1
    assert conflicts[0].field == "email"


@pytest.mark.parametrize(
    ("message", "field"),
    [
        ("UNIQUE constraint failed: users.email", "email"),
        ('duplicate key value violates unique constraint "ux_users_email"', "email"),
        ("UNIQUE constraint failed: users.username", "username"),
        ("Key (username)=(myemail1) already exists. ux_users_username", "username"),
    ],
)
def test_conflict_field(message: str, field: str):
    assert _conflict_field(IntegrityError("stmt", {}, Exception(message))) == field

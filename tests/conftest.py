import os
from collections.abc import AsyncIterator, Awaitable, Callable
from pathlib import Path
from uuid import UUID, uuid4

TEST_JWT_SECRET = "test-jwt-secret-0123456789abcdef-0123456789"
os.environ.setdefault("JWT_SECRET", TEST_JWT_SECRET)

import httpx  # noqa: E402
import pytest  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from httpx import ASGITransport  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker  # noqa: E402

import app.models  # noqa: E402, F401
from app.config import Settings  # noqa: E402
from app.db import Base, build_engine, build_session_factory  # noqa: E402
from app.main import create_app  # noqa: E402
from tests.factories import (  # noqa: E402
    AuthedUser,
    create_category,
    create_user,
    soft_delete_user,
)


@pytest.fixture
def database_url(tmp_path: Path) -> str:
    return f"sqlite+aiosqlite:///{tmp_path}/test.db"


@pytest.fixture
async def engine(database_url: str) -> AsyncIterator[AsyncEngine]:
    engine = build_engine(database_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture
def session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return build_session_factory(engine)


@pytest.fixture
def settings(database_url: str) -> Settings:
    return Settings(database_url=database_url, jwt_secret=TEST_JWT_SECRET, _env_file=None)


@pytest.fixture
async def app(settings: Settings, engine: AsyncEngine) -> AsyncIterator[FastAPI]:
    application = create_app(settings)
    async with application.router.lifespan_context(application):
        yield application


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
def make_user(app: FastAPI, settings: Settings) -> Callable[..., Awaitable[AuthedUser]]:
    async def _make_user(
        username: str | None = None,
        *,
        email: str | None = None,
        password: str = "password123",
    ) -> AuthedUser:
        username = username or f"user_{uuid4().hex[:8]}"
        return await create_user(
            app.state.session_factory,
            settings,
            username=username,
            email=email or f"{username}@example.com",
            password=password,
        )

    return _make_user


@pytest.fixture
async def user(make_user: Callable[..., Awaitable[AuthedUser]]) -> AuthedUser:
    return await make_user("alice")


@pytest.fixture
async def other_user(make_user: Callable[..., Awaitable[AuthedUser]]) -> AuthedUser:
    return await make_user("bob")


@pytest.fixture
def make_category(app: FastAPI) -> Callable[[AuthedUser, str], Awaitable[UUID]]:
    async def _make_category(owner: AuthedUser, name: str) -> UUID:
        return await create_category(app.state.session_factory, owner.id, name)

    return _make_category


@pytest.fixture
def delete_user(app: FastAPI) -> Callable[[AuthedUser], Awaitable[None]]:
    async def _delete_user(user: AuthedUser) -> None:
        await soft_delete_user(app.state.session_factory, user.id)

    return _delete_user

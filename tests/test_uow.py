import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import Settings
from app.models import Category
from app.services.uow import unit_of_work
from tests.factories import AuthedUser, create_user


@pytest.fixture
async def owner(
    session_factory: async_sessionmaker[AsyncSession], settings: Settings
) -> AuthedUser:
    return await create_user(
        session_factory,
        settings,
        username="alice",
        email="alice@example.com",
        password="password123",
    )


async def test_commits_on_success(
    session_factory: async_sessionmaker[AsyncSession], owner: AuthedUser
) -> None:
    async with unit_of_work(session_factory, owner.id) as uow:
        await uow.categories.add(Category(name="work"))

    async with unit_of_work(session_factory, owner.id) as uow:
        assert await uow.categories.get_or_none(name="work") is not None


async def test_rolls_back_on_exception(
    session_factory: async_sessionmaker[AsyncSession], owner: AuthedUser
) -> None:
    with pytest.raises(RuntimeError):
        async with unit_of_work(session_factory, owner.id) as uow:
            await uow.categories.add(Category(name="work"))
            raise RuntimeError("boom")

    async with unit_of_work(session_factory, owner.id) as uow:
        assert await uow.categories.get_or_none(name="work") is None


async def test_repositories_share_session_and_actor(
    session_factory: async_sessionmaker[AsyncSession], owner: AuthedUser
) -> None:
    async with unit_of_work(session_factory, owner.id) as uow:
        assert uow.users.session is uow.notes.session is uow.categories.session
        assert uow.users.actor_id == uow.notes.actor_id == uow.categories.actor_id == owner.id

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.repositories.category import CategoryRepository
from app.repositories.note import NoteRepository
from app.repositories.user import UserRepository


class UnitOfWork:
    def __init__(self, session: AsyncSession, actor_id: UUID | None):
        self.users = UserRepository(session, actor_id)
        self.notes = NoteRepository(session, actor_id)
        self.categories = CategoryRepository(session, actor_id)


@asynccontextmanager
async def unit_of_work(
    session_factory: async_sessionmaker[AsyncSession], actor_id: UUID | None
) -> AsyncIterator[UnitOfWork]:
    async with session_factory() as session, session.begin():
        yield UnitOfWork(session, actor_id)

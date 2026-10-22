from dataclasses import dataclass
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import Settings
from app.models import Category, User
from app.repositories.category import CategoryRepository
from app.repositories.user import UserRepository
from app.security import create_access_token, hash_password


@dataclass(frozen=True)
class AuthedUser:
    id: UUID
    username: str
    email: str
    password: str
    token: str

    @property
    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"}


async def create_user(
    session_factory: async_sessionmaker[AsyncSession],
    settings: Settings,
    *,
    username: str,
    email: str,
    password: str,
) -> AuthedUser:
    user_id = uuid4()
    async with session_factory() as session, session.begin():
        await UserRepository(session, user_id).add(
            User(
                id=user_id,
                username=username,
                email=email,
                password_hash=hash_password(password),
            )
        )
    token = create_access_token(user_id, settings)
    return AuthedUser(user_id, username, email, password, token)


async def create_category(
    session_factory: async_sessionmaker[AsyncSession], owner_id: UUID, name: str
) -> UUID:
    async with session_factory() as session, session.begin():
        category = await CategoryRepository(session, owner_id).add(Category(name=name))
        return category.id


async def soft_delete_user(
    session_factory: async_sessionmaker[AsyncSession], user_id: UUID
) -> None:
    async with session_factory() as session, session.begin():
        repo = UserRepository(session, user_id)
        user = await repo.get(user_id)
        assert user is not None
        await repo.soft_delete(user)

from uuid import uuid4

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import Settings
from app.exceptions import AuthenticationFailed, Conflict
from app.models import User
from app.schemas.auth import RegisterRequest, Token
from app.schemas.user import UserRead
from app.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.services.uow import unit_of_work


def _conflict_field(exc: IntegrityError) -> str:
    message = str(exc.orig)
    return "email" if "users.email" in message or "ux_users_email" in message else "username"


class AuthService:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession], settings: Settings):
        self._session_factory = session_factory
        self._settings = settings

    async def register(self, data: RegisterRequest) -> UserRead:
        email = data.email.lower()
        user_id = uuid4()
        async with unit_of_work(self._session_factory, user_id) as uow:
            if await uow.users.get_or_none(username=data.username) is not None:
                raise Conflict("Username already taken", field="username")
            if await uow.users.get_or_none(email=email) is not None:
                raise Conflict("Email already taken", field="email")
            try:
                user = await uow.users.add(
                    User(
                        id=user_id,
                        username=data.username,
                        email=email,
                        password_hash=hash_password(data.password),
                    )
                )
            except IntegrityError as exc:
                field = _conflict_field(exc)
                raise Conflict(f"{field.capitalize()} already taken", field=field) from exc
            return UserRead.model_validate(user)

    async def login(self, username: str, password: str) -> Token:
        async with unit_of_work(self._session_factory, None) as uow:
            user = await uow.users.get_or_none(username=username)
            if user is None or not verify_password(password, user.password_hash):
                raise AuthenticationFailed("Incorrect username or password")
            user_id = user.id
        return Token(access_token=create_access_token(user_id, self._settings))

    async def resolve_token(self, token: str) -> UserRead:
        user_id = decode_access_token(token, self._settings)
        async with unit_of_work(self._session_factory, None) as uow:
            user = await uow.users.get(user_id)
            if user is None:
                raise AuthenticationFailed("Could not validate credentials")
            return UserRead.model_validate(user)

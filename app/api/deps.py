from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import Settings
from app.schemas.user import UserRead
from app.services.auth import AuthService


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_session_factory(request: Request) -> async_sessionmaker[AsyncSession]:
    return request.app.state.session_factory


SettingsDep = Annotated[Settings, Depends(get_settings)]
SessionFactoryDep = Annotated[async_sessionmaker[AsyncSession], Depends(get_session_factory)]

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def get_auth_service(session_factory: SessionFactoryDep, settings: SettingsDep) -> AuthService:
    return AuthService(session_factory, settings)


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)], auth_service: AuthServiceDep
) -> UserRead:
    return await auth_service.resolve_token(token)


CurrentUserDep = Annotated[UserRead, Depends(get_current_user)]

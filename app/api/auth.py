from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import AuthServiceDep
from app.api.responses import CONFLICT, UNAUTHORIZED
from app.schemas.auth import RegisterRequest, Token
from app.schemas.user import UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=201, responses=CONFLICT, response_model=UserRead)
async def register(data: RegisterRequest, service: AuthServiceDep) -> UserRead:
    return await service.register(data)


@router.post("/login", response_model=Token, responses=UNAUTHORIZED)
async def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()], service: AuthServiceDep
) -> Token:
    return await service.login(form.username, form.password)

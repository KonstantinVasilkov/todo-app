from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.api import auth, categories, notes, users
from app.config import Settings
from app.db import build_engine, build_session_factory
from app.exceptions import (
    AuthenticationFailed,
    Conflict,
    DomainError,
    InvalidReference,
    NotFound,
)
from app.schemas.errors import DomainErrorItem, DomainErrorType, ErrorResponse

_STATUS_BY_ERROR: dict[type[DomainError], int] = {
    NotFound: status.HTTP_404_NOT_FOUND,
    Conflict: status.HTTP_409_CONFLICT,
    InvalidReference: status.HTTP_422_UNPROCESSABLE_CONTENT,
    AuthenticationFailed: status.HTTP_401_UNAUTHORIZED,
}


async def domain_error_handler(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, DomainError):
        raise exc
    status_code = _STATUS_BY_ERROR.get(type(exc), status.HTTP_400_BAD_REQUEST)
    if exc.field is not None:
        item = DomainErrorItem(
            loc=["body", exc.field], msg=exc.message, type=DomainErrorType(exc.code)
        )
        error = ErrorResponse(detail=[item])
    else:
        error = ErrorResponse(detail=exc.message)
    body = error.model_dump(mode="json")
    headers = {"WWW-Authenticate": "Bearer"} if isinstance(exc, AuthenticationFailed) else None
    return JSONResponse(body, status_code=status_code, headers=headers)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
        engine = build_engine(settings.database_url)
        app.state.engine = engine
        app.state.session_factory = build_session_factory(engine)
        try:
            yield
        finally:
            await engine.dispose()

    app = FastAPI(title="TODO API", lifespan=lifespan)
    app.state.settings = settings
    app.add_exception_handler(DomainError, domain_error_handler)
    app.include_router(auth.router)
    app.include_router(users.router)
    app.include_router(notes.router)
    app.include_router(categories.router)
    return app


app = create_app()

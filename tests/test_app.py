from datetime import timedelta
from uuid import uuid4

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.api.deps import CurrentUserDep
from app.config import Settings
from app.exceptions import Conflict, InvalidReference, NotFound
from app.security import create_access_token


def test_lifespan_sets_state(app: FastAPI, settings: Settings):
    assert isinstance(app.state.session_factory, async_sessionmaker)
    assert app.state.settings is settings


async def test_root_path_from_server(app: FastAPI):
    transport = httpx.ASGITransport(app=app, root_path="/api")
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        docs = await c.get("/docs")
        schema = await c.get("/openapi.json")
    assert "/api/openapi.json" in docs.text
    assert schema.json()["servers"] == [{"url": "/api"}]


async def test_domain_error_without_field(app: FastAPI, client: httpx.AsyncClient):
    async def boom():
        raise NotFound("Note not found")

    app.add_api_route("/_boom", boom)
    response = await client.get("/_boom")
    assert response.status_code == 404
    assert response.json() == {"detail": "Note not found"}


async def test_domain_error_with_field(app: FastAPI, client: httpx.AsyncClient):
    async def conflict():
        raise Conflict("Username already taken", field="username")

    async def invalid():
        raise InvalidReference("Unknown category", field="category_ids")

    app.add_api_route("/_conflict", conflict)
    app.add_api_route("/_invalid", invalid)

    response = await client.get("/_conflict")
    assert response.status_code == 409
    assert response.json() == {
        "detail": [
            {"loc": ["body", "username"], "msg": "Username already taken", "type": "conflict"}
        ]
    }

    response = await client.get("/_invalid")
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail[0]["loc"] == ["body", "category_ids"]
    assert detail[0]["type"] == "invalid_reference"


@pytest.fixture
def me_route(app: FastAPI):
    async def me(current_user: CurrentUserDep):
        return {"id": str(current_user.id)}

    app.add_api_route("/_me", me)


@pytest.mark.usefixtures("me_route")
async def test_current_user_ok(client, user):
    response = await client.get("/_me", headers=user.headers)
    assert response.status_code == 200
    assert response.json() == {"id": str(user.id)}


@pytest.mark.usefixtures("me_route")
async def test_current_user_rejections(client, user, settings, delete_user):
    expired = create_access_token(user.id, settings, ttl=timedelta(seconds=-10))
    unknown = create_access_token(uuid4(), settings)

    responses = [
        await client.get("/_me"),
        await client.get("/_me", headers={"Authorization": f"Bearer {expired}"}),
        await client.get("/_me", headers={"Authorization": f"Bearer {unknown}"}),
    ]
    await delete_user(user)
    responses.append(await client.get("/_me", headers=user.headers))

    for response in responses:
        assert response.status_code == 401
        assert response.headers["WWW-Authenticate"] == "Bearer"

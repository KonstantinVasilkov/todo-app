import json
from pathlib import Path

import pytest
from fastapi import FastAPI

ROOT = Path(__file__).resolve().parent.parent

CASES = [
    *[
        (401, method, path)
        for path, methods in {
            "/users/me": ["get"],
            "/notes": ["get", "post"],
            "/notes/{note_id}": ["get", "patch", "delete"],
            "/categories": ["get", "post"],
            "/categories/{category_id}": ["patch", "delete"],
            "/auth/login": ["post"],
        }.items()
        for method in methods
    ],
    (404, "get", "/notes/{note_id}"),
    (404, "patch", "/notes/{note_id}"),
    (404, "delete", "/notes/{note_id}"),
    (404, "patch", "/categories/{category_id}"),
    (404, "delete", "/categories/{category_id}"),
    (409, "post", "/auth/register"),
    (409, "post", "/categories"),
    (409, "patch", "/categories/{category_id}"),
    (422, "post", "/notes"),
    (422, "patch", "/notes/{note_id}"),
]


def test_snapshot_matches_app(app: FastAPI):
    snapshot = json.loads((ROOT / "openapi.json").read_text())
    assert snapshot == json.loads(json.dumps(app.openapi())), (
        "openapi.json is stale: run `uv run python scripts/export_openapi.py`"
    )


@pytest.mark.parametrize(("code", "method", "path"), CASES)
def test_error_responses_documented(app: FastAPI, code: int, method: str, path: str):
    responses = app.openapi()["paths"][path][method]["responses"]
    assert str(code) in responses
    ref = responses[str(code)]["content"]["application/json"]["schema"]["$ref"]
    assert ref == "#/components/schemas/ErrorResponse"


def test_domain_error_types_enum(app: FastAPI):
    schemas = app.openapi()["components"]["schemas"]
    assert schemas["DomainErrorType"]["enum"] == ["conflict", "invalid_reference"]


def test_422_covers_both_kinds(app: FastAPI):
    schemas = app.openapi()["components"]["schemas"]
    variants = schemas["ErrorResponse"]["properties"]["detail"]["anyOf"]
    array = next(v for v in variants if v.get("type") == "array")
    refs = {item["$ref"] for item in array["items"]["anyOf"]}
    assert refs == {
        "#/components/schemas/DomainErrorItem",
        "#/components/schemas/ValidationErrorItem",
    }
    assert "enum" not in schemas["ValidationErrorItem"]["properties"]["type"]
    assert schemas["DomainErrorItem"]["properties"]["type"] == {
        "$ref": "#/components/schemas/DomainErrorType"
    }


def test_token_url_relative(app: FastAPI):
    scheme = app.openapi()["components"]["securitySchemes"]["OAuth2PasswordBearer"]
    assert scheme["flows"]["password"]["tokenUrl"] == "auth/login"


def test_note_update_title_not_nullable(app: FastAPI):
    props = app.openapi()["components"]["schemas"]["NoteUpdate"]["properties"]

    def nullable(name: str) -> bool:
        return {"type": "null"} in props[name].get("anyOf", [])

    assert not nullable("title")
    assert not nullable("category_ids")
    assert all(nullable(name) for name in ("body", "due", "status"))

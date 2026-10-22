from pathlib import Path

import pytest
from dotenv import dotenv_values
from pydantic import ValidationError

from app.config import Settings

ROOT = Path(__file__).resolve().parent.parent
ENV_VARS = ["DATABASE_URL", "JWT_SECRET", "JWT_ALGORITHM", "JWT_TTL_MINUTES"]


def test_settings_defaults(monkeypatch):
    for name in ENV_VARS:
        monkeypatch.delenv(name, raising=False)
    settings = Settings(jwt_secret="x" * 32, _env_file=None)
    assert settings.database_url == "sqlite+aiosqlite:///./todo.db"
    assert settings.jwt_algorithm == "HS256"
    assert settings.jwt_ttl_minutes == 60


def test_settings_rejects_short_jwt_secret(monkeypatch):
    for name in ENV_VARS:
        monkeypatch.delenv(name, raising=False)
    with pytest.raises(ValidationError):
        Settings(jwt_secret="x" * 31, _env_file=None)


def test_settings_requires_jwt_secret(monkeypatch):
    monkeypatch.delenv("JWT_SECRET", raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_settings_has_no_root_path():
    assert "root_path" not in Settings.model_fields


def test_env_example_secret_is_not_usable(monkeypatch):
    monkeypatch.delenv("JWT_SECRET", raising=False)
    assert dotenv_values(ROOT / ".env.example")["JWT_SECRET"] in ("", None)
    with pytest.raises(ValidationError):
        Settings(_env_file=ROOT / ".env.example")

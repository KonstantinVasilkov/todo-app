from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
import pytest

from app.config import Settings
from app.exceptions import AuthenticationFailed
from app.security import create_access_token, decode_access_token, hash_password, verify_password

SECRET = "test-jwt-secret-0123456789abcdef-0123456789"


@pytest.fixture
def settings() -> Settings:
    return Settings(jwt_secret=SECRET, _env_file=None)


def test_hash_and_verify():
    hashed = hash_password("password123")
    assert hashed != "password123"
    assert hashed.startswith("$argon2")
    assert verify_password("password123", hashed) is True
    assert verify_password("wrong", hashed) is False


def test_token_round_trip(settings: Settings):
    uid = uuid4()
    assert decode_access_token(create_access_token(uid, settings), settings) == uid


def test_expired_token_rejected(settings: Settings):
    token = create_access_token(uuid4(), settings, ttl=timedelta(seconds=-10))
    with pytest.raises(AuthenticationFailed):
        decode_access_token(token, settings)


def test_token_with_wrong_secret_rejected(settings: Settings):
    other = Settings(jwt_secret="other-jwt-secret-0123456789abcdef-0123456789", _env_file=None)
    token = create_access_token(uuid4(), other)
    with pytest.raises(AuthenticationFailed):
        decode_access_token(token, settings)


def test_garbage_token_rejected(settings: Settings):
    with pytest.raises(AuthenticationFailed):
        decode_access_token("not-a-jwt", settings)


def test_token_with_non_uuid_sub_rejected(settings: Settings):
    token = jwt.encode(
        {"sub": "abc", "exp": datetime.now(UTC) + timedelta(minutes=5)}, settings.jwt_secret
    )
    with pytest.raises(AuthenticationFailed):
        decode_access_token(token, settings)

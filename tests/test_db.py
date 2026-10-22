from datetime import UTC, datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models import Category, Note, User


def make_user(uid: UUID | None = None, **kwargs) -> User:
    uid = uid or uuid4()
    now = datetime.now(UTC)
    fields = {
        "id": uid,
        "username": f"user-{uid.hex[:8]}",
        "email": f"{uid.hex[:8]}@example.com",
        "password_hash": "hash",
        "created_at": now,
        "updated_at": now,
        "created_by": uid,
        "updated_by": uid,
    }
    fields.update(kwargs)
    return User(**fields)


def make_category(owner: UUID, name: str = "work", **kwargs) -> Category:
    now = datetime.now(UTC)
    fields = {
        "name": name,
        "created_at": now,
        "updated_at": now,
        "created_by": owner,
        "updated_by": owner,
    }
    fields.update(kwargs)
    return Category(**fields)


def make_note(owner: UUID, **kwargs) -> Note:
    now = datetime.now(UTC)
    fields = {
        "title": "t",
        "created_at": now,
        "updated_at": now,
        "created_by": owner,
        "updated_by": owner,
    }
    fields.update(kwargs)
    return Note(**fields)


async def _insert_user(session_factory: async_sessionmaker[AsyncSession]) -> User:
    async with session_factory() as session, session.begin():
        user = make_user()
        session.add(user)
    return user


async def _read_due(session_factory, note_id: UUID) -> datetime | None:
    async with session_factory() as session:
        note = await session.get(Note, note_id)
        return note.due


async def test_utc_datetime_converts_offset_to_utc(session_factory):
    user = await _insert_user(session_factory)
    due = datetime(2026, 10, 21, 15, 0, tzinfo=timezone(timedelta(hours=3)))
    async with session_factory() as session, session.begin():
        note = make_note(user.id, due=due)
        session.add(note)
    loaded = await _read_due(session_factory, note.id)
    assert loaded == datetime(2026, 10, 21, 12, 0, tzinfo=UTC)
    assert loaded is not None
    assert loaded.tzinfo is UTC


async def test_utc_datetime_treats_naive_as_utc(session_factory):
    user = await _insert_user(session_factory)
    async with session_factory() as session, session.begin():
        note = make_note(user.id, due=datetime(2026, 10, 21, 12, 0))
        session.add(note)
    loaded = await _read_due(session_factory, note.id)
    assert loaded == datetime(2026, 10, 21, 12, 0, tzinfo=UTC)


async def test_foreign_keys_enforced(session_factory):
    async with session_factory() as session:
        session.add(make_category(uuid4()))
        with pytest.raises(IntegrityError):
            await session.flush()


async def test_user_self_reference_insert(session_factory):
    user = await _insert_user(session_factory)
    async with session_factory() as session:
        loaded = await session.get(User, user.id)
        assert loaded.created_by == loaded.id


async def test_status_check_constraints(session_factory):
    user = await _insert_user(session_factory)
    for bad in (
        make_user(status="x"),
        make_category(user.id, status="x"),
        make_note(user.id, status="bad"),
    ):
        async with session_factory() as session:
            session.add(bad)
            with pytest.raises(IntegrityError):
                await session.flush()
    async with session_factory() as session, session.begin():
        session.add(make_note(user.id, status="in_progress"))
        session.add(make_note(user.id, status=None))


async def test_unique_user_fields_among_live_rows_only(session_factory):
    first = await _insert_user(session_factory)
    for field in ("username", "email"):
        dup = make_user(**{field: getattr(first, field)})
        if field == "username":
            dup.email = "other@example.com"
        else:
            dup.username = "other-name"
        async with session_factory() as session:
            session.add(dup)
            with pytest.raises(IntegrityError):
                await session.flush()
    async with session_factory() as session, session.begin():
        live = await session.get(User, first.id)
        live.deleted_at = datetime.now(UTC)
    async with session_factory() as session, session.begin():
        session.add(make_user(username=first.username, email=first.email))


async def test_unique_category_name_per_owner_among_live_rows(session_factory):
    owner = await _insert_user(session_factory)
    other = await _insert_user(session_factory)
    async with session_factory() as session, session.begin():
        first = make_category(owner.id, "work")
        session.add(first)
        session.add(make_category(other.id, "work"))
    async with session_factory() as session:
        session.add(make_category(owner.id, "work"))
        with pytest.raises(IntegrityError):
            await session.flush()
    async with session_factory() as session, session.begin():
        loaded = await session.get(Category, first.id)
        loaded.deleted_at = datetime.now(UTC)
    async with session_factory() as session, session.begin():
        session.add(make_category(owner.id, "work"))
    assert Category(name="Straße").name_key == "strasse"


async def test_unique_category_name_is_case_insensitive(session_factory):
    owner = await _insert_user(session_factory)
    async with session_factory() as session, session.begin():
        first = make_category(owner.id, "Work")
        session.add(first)
    async with session_factory() as session:
        session.add(make_category(owner.id, "work"))
        with pytest.raises(IntegrityError):
            await session.flush()
    async with session_factory() as session, session.begin():
        loaded = await session.get(Category, first.id)
        loaded.deleted_at = datetime.now(UTC)
    async with session_factory() as session, session.begin():
        session.add(make_category(owner.id, "work"))

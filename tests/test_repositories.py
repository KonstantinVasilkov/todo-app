from datetime import UTC, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import func, insert, select
from sqlalchemy.exc import InvalidRequestError, MultipleResultsFound
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models import Category, Note, User, note_category
from app.repositories import CategoryRepository, NoteRepository, UserRepository


async def make_user(session: AsyncSession, username: str = "alice") -> UUID:
    uid = uuid4()
    await UserRepository(session, actor_id=uid).add(
        User(id=uid, username=username, email=f"{username}@example.com", password_hash="x")
    )
    return uid


async def test_add_sets_audit_fields(session_factory: async_sessionmaker[AsyncSession]):
    async with session_factory() as s, s.begin():
        actor = await make_user(s)
        cat = await CategoryRepository(s, actor_id=actor).add(Category(name="a"))
        assert isinstance(cat.id, UUID)
        assert cat.id.version == 4
        assert cat.created_at == cat.updated_at
        assert cat.created_at.tzinfo is not None
        assert cat.created_at.utcoffset() == timedelta(0)
        assert cat.created_at.tzinfo is UTC or cat.created_at.tzname() == "UTC"
        assert cat.created_by == cat.updated_by == actor


async def test_update_bumps_updated_fields_only(
    session_factory: async_sessionmaker[AsyncSession],
):
    async with session_factory() as s, s.begin():
        actor = await make_user(s)
        cat = await CategoryRepository(s, actor_id=actor).add(Category(name="a"))
        cat_id = cat.id
        created_at = cat.created_at
    async with session_factory() as s, s.begin():
        repo = CategoryRepository(s, actor_id=actor)
        cat = await repo.get(cat_id)
        assert cat is not None
        await repo.update(cat, name="b")
        assert cat.name == "b"
        assert cat.updated_at > cat.created_at
        assert cat.created_at == created_at
        assert cat.created_by == actor


async def test_soft_delete_hides_row(session_factory: async_sessionmaker[AsyncSession]):
    async with session_factory() as s, s.begin():
        actor = await make_user(s)
        repo = CategoryRepository(s, actor_id=actor)
        cat = await repo.add(Category(name="a"))
        await repo.soft_delete(cat)
        assert cat.deleted_at is not None
        assert cat.updated_by == actor
        assert await repo.get(cat.id) is None
        assert await repo.list() == []
        assert await repo.count() == 0
        assert await repo.get_or_none(name="a") is None
        assert await repo.list(Category.id.in_([cat.id])) == []


async def test_owner_scoping(session_factory: async_sessionmaker[AsyncSession]):
    async with session_factory() as s, s.begin():
        a = await make_user(s, "alice")
        b = await make_user(s, "bob")
        cat = await CategoryRepository(s, actor_id=a).add(Category(name="a"))
        other = CategoryRepository(s, actor_id=b)
        assert await other.get(cat.id) is None
        assert await other.list() == []
        assert await other.get_or_none(name="a") is None
        assert await other.list(Category.id.in_([cat.id])) == []
        assert await CategoryRepository(s, actor_id=a).get(cat.id) is cat


async def test_user_repository_ignores_owner(session_factory: async_sessionmaker[AsyncSession]):
    async with session_factory() as s, s.begin():
        uid = await make_user(s, "alice")
        anon = UserRepository(s, actor_id=None)
        user = await anon.get_or_none(username="alice")
        assert user is not None and user.id == uid
        assert (await anon.get_or_none(email="alice@example.com")) is user
        await UserRepository(s, actor_id=uid).soft_delete(user)
        assert await anon.get_or_none(username="alice") is None
        assert await anon.get_or_none(email="alice@example.com") is None


async def test_write_without_actor_raises(session_factory: async_sessionmaker[AsyncSession]):
    async with session_factory() as s, s.begin():
        repo = CategoryRepository(s, actor_id=None)
        with pytest.raises(ValueError):
            await repo.add(Category(name="a"))
        with pytest.raises(ValueError):
            await repo.update(Category(name="a"), name="b")
        with pytest.raises(ValueError):
            await repo.soft_delete(Category(name="a"))


async def test_repository_does_not_commit(session_factory: async_sessionmaker[AsyncSession]):
    uid = uuid4()
    with pytest.raises(RuntimeError):
        async with session_factory() as s, s.begin():
            await UserRepository(s, actor_id=uid).add(
                User(id=uid, username="alice", email="a@example.com", password_hash="x")
            )
            raise RuntimeError
    async with session_factory() as s:
        assert (await s.execute(select(func.count()).select_from(User))).scalar_one() == 0


async def test_remove_category_links(session_factory: async_sessionmaker[AsyncSession]):
    async with session_factory() as s, s.begin():
        actor = await make_user(s)
        cats = CategoryRepository(s, actor_id=actor)
        c1 = await cats.add(Category(name="c1"))
        c2 = await cats.add(Category(name="c2"))
        note = await NoteRepository(s, actor_id=actor).add(Note(title="n"))
        for c in (c1, c2):
            await s.execute(
                insert(note_category).values(
                    note_id=note.id,
                    category_id=c.id,
                    created_at=note.created_at,
                    created_by=actor,
                )
            )
        await NoteRepository(s, actor_id=actor).remove_category_links(c1.id)
        rows = (await s.execute(select(note_category.c.category_id))).scalars().all()
        assert list(rows) == [c2.id]
        assert await NoteRepository(s, actor_id=actor).get(note.id) is note


async def test_get_or_none_by_kwargs_and_expression(
    session_factory: async_sessionmaker[AsyncSession],
):
    async with session_factory() as s, s.begin():
        actor = await make_user(s)
        repo = CategoryRepository(s, actor_id=actor)
        cat = await repo.add(Category(name="a"))
        assert await repo.get_or_none(name="a") is cat
        assert await repo.get_or_none(Category.name == "a") is cat
        assert await repo.get_or_none(name="zzz") is None


async def test_get_or_none_unknown_field_raises(
    session_factory: async_sessionmaker[AsyncSession],
):
    async with session_factory() as s, s.begin():
        actor = await make_user(s)
        with pytest.raises(InvalidRequestError):
            await CategoryRepository(s, actor_id=actor).get_or_none(nope=1)


async def test_get_or_none_multiple_raises(session_factory: async_sessionmaker[AsyncSession]):
    async with session_factory() as s, s.begin():
        actor = await make_user(s)
        repo = CategoryRepository(s, actor_id=actor)
        await repo.add(Category(name="a"))
        await repo.add(Category(name="b"))
        with pytest.raises(MultipleResultsFound):
            await repo.get_or_none(Category.name.in_(["a", "b"]))


async def test_list_uses_default_order(session_factory: async_sessionmaker[AsyncSession]):
    async with session_factory() as s, s.begin():
        actor = await make_user(s)
        repo = CategoryRepository(s, actor_id=actor)
        for name in ("b", "a", "c"):
            await repo.add(Category(name=name))
        assert [c.name for c in await repo.list()] == ["a", "b", "c"]


async def test_paginate_total_and_page(session_factory: async_sessionmaker[AsyncSession]):
    async with session_factory() as s, s.begin():
        actor = await make_user(s)
        repo = CategoryRepository(s, actor_id=actor)
        for name in "abcde":
            await repo.add(Category(name=name))
        items, total = await repo.paginate(limit=2, offset=2)
        assert [c.name for c in items] == ["c", "d"]
        assert total == 5
        assert await repo.paginate(limit=2, offset=10) == ([], 5)


async def test_paginate_stable_tiebreaker(session_factory: async_sessionmaker[AsyncSession]):
    async with session_factory() as s, s.begin():
        actor = await make_user(s)
        repo = CategoryRepository(s, actor_id=actor)
        created_ids = [(await repo.add(Category(name=f"c{i}"))).id for i in range(10)]
        items, _ = await repo.paginate(limit=20, order_by=(Category.created_by,))
        assert [c.id for c in items] == sorted(created_ids)


async def test_new_methods_respect_scope(session_factory: async_sessionmaker[AsyncSession]):
    async with session_factory() as s, s.begin():
        a = await make_user(s, "alice")
        b = await make_user(s, "bob")
        repo_a = CategoryRepository(s, actor_id=a)
        await repo_a.add(Category(name="a"))
        gone = await repo_a.add(Category(name="gone"))
        await repo_a.soft_delete(gone)
        other = CategoryRepository(s, actor_id=b)
        assert await other.get_or_none(name="a") is None
        assert await other.list(Category.name == "a") == []
        assert await other.paginate(limit=10) == ([], 0)
        assert await repo_a.get_or_none(name="gone") is None
        assert await repo_a.list(Category.name == "gone") == []
        items, total = await repo_a.paginate(limit=10)
        assert [c.name for c in items] == ["a"]
        assert total == 1

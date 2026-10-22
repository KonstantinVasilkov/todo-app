from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from sqlalchemy import create_engine, text

import app.models  # noqa: F401
from app.db import Base

ROOT = Path(__file__).resolve().parent.parent


def _config(url: str) -> Config:
    cfg = Config(ROOT / "alembic.ini")
    cfg.set_main_option("sqlalchemy.url", url)
    return cfg


@pytest.fixture
def db_path(tmp_path: Path) -> Path:
    return tmp_path / "m.db"


@pytest.fixture
def cfg(db_path: Path) -> Config:
    return _config(f"sqlite+aiosqlite:///{db_path}")


def test_upgrade_head_matches_models(cfg, db_path):
    command.upgrade(cfg, "head")
    engine = create_engine(f"sqlite:///{db_path}")
    with engine.connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn), Base.metadata)
    engine.dispose()
    assert diff == []


@pytest.mark.parametrize(
    "index", ["ux_users_username", "ux_users_email", "ux_categories_created_by_name_key"]
)
def test_upgrade_creates_partial_unique_indexes(cfg, db_path, index):
    command.upgrade(cfg, "head")
    engine = create_engine(f"sqlite:///{db_path}")
    with engine.connect() as conn:
        sql = conn.execute(
            text("SELECT sql FROM sqlite_master WHERE name = :name"), {"name": index}
        ).scalar_one()
    engine.dispose()
    assert "WHERE deleted_at IS NULL" in sql


def test_downgrade_to_base(cfg, db_path):
    command.upgrade(cfg, "head")
    command.downgrade(cfg, "base")
    engine = create_engine(f"sqlite:///{db_path}")
    with engine.connect() as conn:
        tables = (
            conn.execute(text("SELECT name FROM sqlite_master WHERE type = 'table'"))
            .scalars()
            .all()
        )
    engine.dispose()
    assert tables == ["alembic_version"]


def test_upgrade_0002_backfills_and_dedups(cfg, db_path):
    command.upgrade(cfg, "0001")
    engine = create_engine(f"sqlite:///{db_path}")
    user_a, user_b = uuid4().hex, uuid4().hex
    with engine.begin() as conn:
        for uid, name in ((user_a, "a"), (user_b, "b")):
            conn.execute(
                text(
                    "INSERT INTO users (id, username, email, password_hash, created_at,"
                    " updated_at, created_by, updated_by) VALUES (:id, :n, :e, 'x', :t, :t,"
                    " :id, :id)"
                ),
                {"id": uid, "n": name, "e": f"{name}@x.io", "t": "2026-01-01 00:00:00"},
            )
        rows = [
            (user_a, "Work", "2026-01-01 00:00:00", None),
            (user_a, "work", "2026-01-02 00:00:00", None),
            (user_b, "work", "2026-01-03 00:00:00", None),
            (user_a, "WORK", "2026-01-04 00:00:00", "2026-01-05 00:00:00"),
        ]
        for owner, name, created, deleted in rows:
            conn.execute(
                text(
                    "INSERT INTO categories (id, name, created_at, updated_at, created_by,"
                    " updated_by, deleted_at) VALUES (:id, :name, :t, :t, :o, :o, :d)"
                ),
                {"id": uuid4().hex, "name": name, "t": created, "o": owner, "d": deleted},
            )

    command.upgrade(cfg, "head")

    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT created_by, name, name_key, deleted_at FROM categories")
        ).all()
    engine.dispose()
    live_a = {r.name for r in rows if r.created_by == user_a and r.deleted_at is None}
    live_b = {r.name for r in rows if r.created_by == user_b}
    deleted = {r.name for r in rows if r.deleted_at is not None}
    assert live_a == {"Work", "work (2)"}
    assert live_b == {"work"}
    assert deleted == {"WORK"}
    assert all(r.name_key == r.name.casefold() for r in rows)


def _seed_0001(cfg, db_path, categories):
    command.upgrade(cfg, "0001")
    engine = create_engine(f"sqlite:///{db_path}")
    owner = uuid4().hex
    ids = {}
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO users (id, username, email, password_hash, created_at,"
                " updated_at, created_by, updated_by) VALUES (:id, 'o', 'o@x.io', 'x', :t, :t,"
                " :id, :id)"
            ),
            {"id": owner, "t": "2026-01-01 00:00:00"},
        )
        for name, created in categories:
            cid = uuid4().hex
            ids[name] = cid
            conn.execute(
                text(
                    "INSERT INTO categories (id, name, created_at, updated_at, created_by,"
                    " updated_by) VALUES (:id, :name, :t, :t, :o, :o)"
                ),
                {"id": cid, "name": name, "t": created, "o": owner},
            )
    return engine, ids


def _live_rows(engine):
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT id, name FROM categories")).all()
    engine.dispose()
    return rows


def test_upgrade_0002_dedup_does_not_collide_with_existing_suffix(cfg, db_path):
    engine, ids = _seed_0001(
        cfg,
        db_path,
        [
            ("Work", "2026-01-01 00:00:00"),
            ("work", "2026-01-02 00:00:00"),
            ("work (2)", "2026-01-03 00:00:00"),
        ],
    )
    command.upgrade(cfg, "head")
    rows = _live_rows(engine)
    assert {r.name for r in rows} == {"Work", "work (2)", "work (3)"}
    assert {r.id: r.name for r in rows}[ids["work (2)"]] == "work (2)"


def test_upgrade_0002_keeps_non_duplicates(cfg, db_path):
    engine, _ = _seed_0001(
        cfg,
        db_path,
        [("Work", "2026-01-01 00:00:00"), ("Work (2)", "2026-01-02 00:00:00")],
    )
    command.upgrade(cfg, "head")
    assert {r.name for r in _live_rows(engine)} == {"Work", "Work (2)"}


def test_upgrade_0002_dedup_keeps_name_within_50_chars(cfg, db_path):
    long_name = "a" * 50
    engine, ids = _seed_0001(
        cfg,
        db_path,
        [(long_name, "2026-01-01 00:00:00"), (long_name.upper(), "2026-01-02 00:00:00")],
    )
    command.upgrade(cfg, "head")
    names = {r.id: r.name for r in _live_rows(engine)}
    assert names[ids[long_name]] == long_name
    renamed = names[ids[long_name.upper()]]
    assert len(renamed) <= 50
    assert renamed.endswith(" (2)")

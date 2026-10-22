from collections import defaultdict
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | Sequence[str] | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_LIVE = sa.text("deleted_at IS NULL")
_MAX_NAME = 50

_categories = sa.table(
    "categories",
    sa.column("id", sa.Uuid()),
    sa.column("created_by", sa.Uuid()),
    sa.column("name", sa.String()),
    sa.column("name_key", sa.String()),
    sa.column("deleted_at", sa.DateTime(timezone=True)),
    sa.column("created_at", sa.DateTime(timezone=True)),
)


def _backfill() -> None:
    bind = op.get_bind()
    rows = bind.execute(
        sa.select(
            _categories.c.id,
            _categories.c.created_by,
            _categories.c.name,
            _categories.c.deleted_at,
            _categories.c.created_at,
        )
    ).all()

    names = {row.id: row.name for row in rows}
    live = sorted((r for r in rows if r.deleted_at is None), key=lambda r: (r.created_at, r.id))
    taken: dict[object, set[str]] = defaultdict(set)
    for row in live:
        taken[row.created_by].add(row.name.casefold())
    seen: dict[object, set[str]] = defaultdict(set)
    for row in live:
        key = row.name.casefold()
        if key not in seen[row.created_by]:
            seen[row.created_by].add(key)
            continue
        owner_keys = taken[row.created_by]
        n = 2
        while True:
            suffix = f" ({n})"
            name = f"{row.name[: _MAX_NAME - len(suffix)]}{suffix}"
            if name.casefold() not in owner_keys:
                break
            n += 1
        owner_keys.add(name.casefold())
        names[row.id] = name

    for row in rows:
        name = names[row.id]
        bind.execute(
            sa.update(_categories)
            .where(_categories.c.id == row.id)
            .values(name=name, name_key=name.casefold())
        )


def upgrade() -> None:
    with op.batch_alter_table("categories", schema=None) as batch_op:
        batch_op.add_column(sa.Column("name_key", sa.String(length=150), nullable=True))
        batch_op.drop_index(
            "ux_categories_created_by_name",
            sqlite_where=_LIVE,
            postgresql_where=_LIVE,
        )

    _backfill()

    with op.batch_alter_table("categories", schema=None) as batch_op:
        batch_op.alter_column("name_key", existing_type=sa.String(length=150), nullable=False)
        batch_op.create_index(
            "ux_categories_created_by_name_key",
            ["created_by", "name_key"],
            unique=True,
            sqlite_where=_LIVE,
            postgresql_where=_LIVE,
        )


def downgrade() -> None:
    with op.batch_alter_table("categories", schema=None) as batch_op:
        batch_op.drop_index(
            "ux_categories_created_by_name_key",
            sqlite_where=_LIVE,
            postgresql_where=_LIVE,
        )
        batch_op.drop_column("name_key")
        batch_op.create_index(
            "ux_categories_created_by_name",
            ["created_by", "name"],
            unique=True,
            sqlite_where=_LIVE,
            postgresql_where=_LIVE,
        )

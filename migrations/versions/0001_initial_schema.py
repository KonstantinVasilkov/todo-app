from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("updated_by", sa.Uuid(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status IS NULL", name=op.f("ck_users_status")),
        sa.ForeignKeyConstraint(
            ["created_by"], ["users.id"], name=op.f("fk_users_created_by_users")
        ),
        sa.ForeignKeyConstraint(
            ["updated_by"], ["users.id"], name=op.f("fk_users_updated_by_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
    )
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.create_index(
            "ux_users_email",
            ["email"],
            unique=True,
            sqlite_where=sa.text("deleted_at IS NULL"),
            postgresql_where=sa.text("deleted_at IS NULL"),
        )
        batch_op.create_index(
            "ux_users_username",
            ["username"],
            unique=True,
            sqlite_where=sa.text("deleted_at IS NULL"),
            postgresql_where=sa.text("deleted_at IS NULL"),
        )

    op.create_table(
        "categories",
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("updated_by", sa.Uuid(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status IS NULL", name=op.f("ck_categories_status")),
        sa.ForeignKeyConstraint(
            ["created_by"], ["users.id"], name=op.f("fk_categories_created_by_users")
        ),
        sa.ForeignKeyConstraint(
            ["updated_by"], ["users.id"], name=op.f("fk_categories_updated_by_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_categories")),
    )
    with op.batch_alter_table("categories", schema=None) as batch_op:
        batch_op.create_index(
            "ux_categories_created_by_name",
            ["created_by", "name"],
            unique=True,
            sqlite_where=sa.text("deleted_at IS NULL"),
            postgresql_where=sa.text("deleted_at IS NULL"),
        )

    op.create_table(
        "notes",
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("due", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("updated_by", sa.Uuid(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IS NULL OR status IN ('todo', 'in_progress', 'done')",
            name=op.f("ck_notes_status"),
        ),
        sa.ForeignKeyConstraint(
            ["created_by"], ["users.id"], name=op.f("fk_notes_created_by_users")
        ),
        sa.ForeignKeyConstraint(
            ["updated_by"], ["users.id"], name=op.f("fk_notes_updated_by_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_notes")),
    )
    with op.batch_alter_table("notes", schema=None) as batch_op:
        batch_op.create_index(
            "ix_notes_created_by_deleted_at", ["created_by", "deleted_at"], unique=False
        )
        batch_op.create_index("ix_notes_due", ["due"], unique=False)

    op.create_table(
        "note_category",
        sa.Column("note_id", sa.Uuid(), nullable=False),
        sa.Column("category_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["category_id"], ["categories.id"], name=op.f("fk_note_category_category_id_categories")
        ),
        sa.ForeignKeyConstraint(
            ["created_by"], ["users.id"], name=op.f("fk_note_category_created_by_users")
        ),
        sa.ForeignKeyConstraint(
            ["note_id"], ["notes.id"], name=op.f("fk_note_category_note_id_notes")
        ),
        sa.PrimaryKeyConstraint("note_id", "category_id", name=op.f("pk_note_category")),
    )
    with op.batch_alter_table("note_category", schema=None) as batch_op:
        batch_op.create_index("ix_note_category_category_id", ["category_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("note_category", schema=None) as batch_op:
        batch_op.drop_index("ix_note_category_category_id")

    op.drop_table("note_category")
    with op.batch_alter_table("notes", schema=None) as batch_op:
        batch_op.drop_index("ix_notes_due")
        batch_op.drop_index("ix_notes_created_by_deleted_at")

    op.drop_table("notes")
    with op.batch_alter_table("categories", schema=None) as batch_op:
        batch_op.drop_index(
            "ux_categories_created_by_name",
            sqlite_where=sa.text("deleted_at IS NULL"),
            postgresql_where=sa.text("deleted_at IS NULL"),
        )

    op.drop_table("categories")
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_index(
            "ux_users_username",
            sqlite_where=sa.text("deleted_at IS NULL"),
            postgresql_where=sa.text("deleted_at IS NULL"),
        )
        batch_op.drop_index(
            "ux_users_email",
            sqlite_where=sa.text("deleted_at IS NULL"),
            postgresql_where=sa.text("deleted_at IS NULL"),
        )

    op.drop_table("users")

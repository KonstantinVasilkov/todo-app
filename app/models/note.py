from datetime import datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, Column, ForeignKey, Index, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, UTCDateTime
from app.models.base import EntityMixin
from app.models.category import Category


class NoteStatus(StrEnum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"


note_category = Table(
    "note_category",
    Base.metadata,
    Column("note_id", ForeignKey("notes.id"), primary_key=True),
    Column("category_id", ForeignKey("categories.id"), primary_key=True),
    Column("created_at", UTCDateTime, nullable=False),
    Column("created_by", ForeignKey("users.id"), nullable=False),
    Index("ix_note_category_category_id", "category_id"),
)


class Note(EntityMixin, Base):
    __tablename__ = "notes"
    __table_args__ = (
        CheckConstraint(
            "status IS NULL OR status IN ('todo', 'in_progress', 'done')", name="status"
        ),
        Index("ix_notes_created_by_deleted_at", "created_by", "deleted_at"),
        Index("ix_notes_due", "due"),
    )

    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str | None] = mapped_column(Text)
    due: Mapped[datetime | None] = mapped_column(UTCDateTime)

    categories: Mapped[list[Category]] = relationship(
        secondary=note_category,
        viewonly=True,
        lazy="raise_on_sql",
        order_by=lambda: (Category.name_key, Category.id),
        secondaryjoin=lambda: (
            (Category.id == note_category.c.category_id) & Category.deleted_at.is_(None)
        ),
    )

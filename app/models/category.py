from sqlalchemy import CheckConstraint, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column, validates

from app.db import Base
from app.models.base import EntityMixin

_LIVE = text("deleted_at IS NULL")


class Category(EntityMixin, Base):
    __tablename__ = "categories"
    __table_args__ = (
        CheckConstraint("status IS NULL", name="status"),
        Index(
            "ux_categories_created_by_name_key",
            "created_by",
            "name_key",
            unique=True,
            sqlite_where=_LIVE,
            postgresql_where=_LIVE,
        ),
    )

    name: Mapped[str] = mapped_column(String(50))
    name_key: Mapped[str] = mapped_column(String(150))

    @validates("name")
    def _sync_name_key(self, _key: str, value: str) -> str:
        self.name_key = value.casefold()
        return value

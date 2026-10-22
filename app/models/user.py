from sqlalchemy import CheckConstraint, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import EntityMixin

_LIVE = text("deleted_at IS NULL")


class User(EntityMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("status IS NULL", name="status"),
        Index(
            "ux_users_username",
            "username",
            unique=True,
            sqlite_where=_LIVE,
            postgresql_where=_LIVE,
        ),
        Index(
            "ux_users_email",
            "email",
            unique=True,
            sqlite_where=_LIVE,
            postgresql_where=_LIVE,
        ),
    )

    username: Mapped[str] = mapped_column(String(50))
    email: Mapped[str] = mapped_column(String(320))
    password_hash: Mapped[str] = mapped_column(String(255))

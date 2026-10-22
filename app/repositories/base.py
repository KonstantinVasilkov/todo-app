from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import ColumnElement, Select, func
from sqlalchemy import select as sa_select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import EntityMixin


class BaseRepository[M: EntityMixin]:
    model: type[M]
    owner_scoped: bool = True
    default_order: tuple[ColumnElement[Any], ...] = ()

    def __init__(self, session: AsyncSession, actor_id: UUID | None):
        self.session = session
        self.actor_id = actor_id

    def select(self) -> Select[tuple[M]]:
        stmt = sa_select(self.model).where(self.model.deleted_at.is_(None))
        if self.owner_scoped:
            stmt = stmt.where(self.model.created_by == self.actor_id)
        return stmt

    def _require_actor(self) -> UUID:
        if self.actor_id is None:
            raise ValueError("actor_id is required for write operations")
        return self.actor_id

    def apply_filters(
        self, stmt: Select[tuple[M]], *where: ColumnElement[bool], **eq: Any
    ) -> Select[tuple[M]]:
        return stmt.where(*where).filter_by(**eq)

    async def get(self, id: UUID) -> M | None:
        return await self.get_or_none(id=id)

    async def get_or_none(self, *where: ColumnElement[bool], **eq: Any) -> M | None:
        stmt = self.apply_filters(self.select(), *where, **eq)
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def list(
        self,
        *where: ColumnElement[bool],
        order_by: Sequence[ColumnElement[Any]] | None = None,
        **eq: Any,
    ) -> Sequence[M]:
        stmt = self.apply_filters(self.select(), *where, **eq)
        stmt = stmt.order_by(*(order_by or self.default_order))
        return (await self.session.execute(stmt)).scalars().all()

    async def count(self, *where: ColumnElement[bool], **eq: Any) -> int:
        stmt = self.apply_filters(self.select(), *where, **eq)
        count_stmt = sa_select(func.count()).select_from(stmt.subquery())
        return (await self.session.execute(count_stmt)).scalar_one()

    async def paginate(
        self,
        *where: ColumnElement[bool],
        limit: int,
        offset: int = 0,
        order_by: Sequence[ColumnElement[Any]] | None = None,
        **eq: Any,
    ) -> tuple[Sequence[M], int]:
        total = await self.count(*where, **eq)
        stmt = self.apply_filters(self.select(), *where, **eq)
        stmt = stmt.order_by(*(order_by or self.default_order), self.model.id)
        items = (await self.session.execute(stmt.limit(limit).offset(offset))).scalars().all()
        return items, total

    async def add(self, obj: M) -> M:
        actor = self._require_actor()
        now = datetime.now(UTC)
        if obj.id is None:
            obj.id = uuid4()
        obj.created_at = obj.updated_at = now
        obj.created_by = obj.updated_by = actor
        self.session.add(obj)
        await self.session.flush()
        return obj

    async def update(self, obj: M, **fields: Any) -> M:
        actor = self._require_actor()
        for name, value in fields.items():
            setattr(obj, name, value)
        obj.updated_at = datetime.now(UTC)
        obj.updated_by = actor
        await self.session.flush()
        return obj

    async def soft_delete(self, obj: M) -> None:
        actor = self._require_actor()
        obj.deleted_at = obj.updated_at = datetime.now(UTC)
        obj.updated_by = actor
        await self.session.flush()

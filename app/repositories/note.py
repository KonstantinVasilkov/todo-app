from collections.abc import Collection, Sequence
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import ColumnElement, Select, delete, insert, or_
from sqlalchemy import select as sa_select
from sqlalchemy.orm import selectinload

from app.models import Note, NoteStatus, note_category
from app.repositories.base import BaseRepository


class NoteRepository(BaseRepository[Note]):
    model = Note
    default_order = (Note.due.asc().nulls_last(), Note.created_at.desc())

    def select(self) -> Select[tuple[Note]]:
        return super().select().options(selectinload(Note.categories))

    async def remove_category_links(self, category_id: UUID) -> None:
        await self.session.execute(
            delete(note_category).where(note_category.c.category_id == category_id)
        )

    async def set_categories(self, note: Note, category_ids: Sequence[UUID]) -> None:
        actor = self._require_actor()
        await self.session.execute(delete(note_category).where(note_category.c.note_id == note.id))
        if category_ids:
            now = datetime.now(UTC)
            await self.session.execute(
                insert(note_category),
                [
                    {
                        "note_id": note.id,
                        "category_id": category_id,
                        "created_at": now,
                        "created_by": actor,
                    }
                    for category_id in category_ids
                ],
            )
        await self.session.refresh(note, ["categories"])


def note_conditions(
    *,
    statuses: Collection[NoteStatus | None],
    category_ids: Collection[UUID],
    due_from: datetime | None,
    due_to: datetime | None,
    has_due: bool | None,
) -> list[ColumnElement[bool]]:
    criteria: list[ColumnElement[bool]] = []
    if statuses:
        parts: list[ColumnElement[bool]] = []
        values = [s for s in statuses if s is not None]
        if values:
            parts.append(Note.status.in_(values))
        if len(values) != len(statuses):
            parts.append(Note.status.is_(None))
        criteria.append(or_(*parts))
    if category_ids:
        criteria.append(
            Note.id.in_(
                sa_select(note_category.c.note_id).where(
                    note_category.c.category_id.in_(category_ids)
                )
            )
        )
    if due_from is not None:
        criteria.append(Note.due >= due_from)
    if due_to is not None:
        criteria.append(Note.due <= due_to)
    if has_due is not None:
        criteria.append(Note.due.is_not(None) if has_due else Note.due.is_(None))
    return criteria

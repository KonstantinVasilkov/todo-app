from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.exceptions import InvalidReference, NotFound
from app.models import Category, Note
from app.models.note import NoteStatus
from app.repositories.category import CategoryRepository
from app.repositories.note import NoteRepository, note_conditions
from app.schemas.common import Page
from app.schemas.note import (
    NoteCreate,
    NoteFilters,
    NoteRead,
    NoteStatusFilter,
    NoteUpdate,
)
from app.schemas.user import UserRead
from app.services.uow import unit_of_work


class NoteService:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession], user: UserRead):
        self._session_factory = session_factory
        self._user = user

    async def _validated_category_ids(
        self, categories: CategoryRepository, category_ids: list[UUID]
    ) -> list[UUID]:
        unique = list(dict.fromkeys(category_ids))
        found = {c.id for c in await categories.list(Category.id.in_(unique))}
        missing = [cid for cid in unique if cid not in found]
        if missing:
            raise InvalidReference(
                f"Unknown category ids: {', '.join(str(m) for m in missing)}",
                field="category_ids",
            )
        return unique

    @staticmethod
    async def _get_or_404(notes: NoteRepository, note_id: UUID) -> Note:
        note = await notes.get(note_id)
        if note is None:
            raise NotFound("Note not found")
        return note

    async def create(self, data: NoteCreate) -> NoteRead:
        async with unit_of_work(self._session_factory, self._user.id) as uow:
            ids = await self._validated_category_ids(uow.categories, data.category_ids)
            note = await uow.notes.add(Note(**data.model_dump(exclude={"category_ids"})))
            await uow.notes.set_categories(note, ids)
            return NoteRead.model_validate(note)

    async def get(self, note_id: UUID) -> NoteRead:
        async with unit_of_work(self._session_factory, self._user.id) as uow:
            return NoteRead.model_validate(await self._get_or_404(uow.notes, note_id))

    async def search(self, filters: NoteFilters) -> Page[NoteRead]:
        statuses = [
            None if s is NoteStatusFilter.NONE else NoteStatus(s.value) for s in filters.status
        ]
        async with unit_of_work(self._session_factory, self._user.id) as uow:
            items, total = await uow.notes.paginate(
                *note_conditions(
                    statuses=statuses,
                    category_ids=filters.category_id,
                    due_from=filters.due_from,
                    due_to=filters.due_to,
                    has_due=filters.has_due,
                ),
                limit=filters.limit,
                offset=filters.offset,
            )
            return Page[NoteRead](
                items=[NoteRead.model_validate(n) for n in items],
                total=total,
                limit=filters.limit,
                offset=filters.offset,
            )

    async def update(self, note_id: UUID, data: NoteUpdate) -> NoteRead:
        async with unit_of_work(self._session_factory, self._user.id) as uow:
            note = await self._get_or_404(uow.notes, note_id)
            fields = data.model_dump(exclude_unset=True)
            if fields:
                category_ids = fields.pop("category_ids", None)
                if category_ids is not None:
                    ids = await self._validated_category_ids(uow.categories, category_ids)
                    await uow.notes.set_categories(note, ids)
                await uow.notes.update(note, **fields)
            return NoteRead.model_validate(note)

    async def delete(self, note_id: UUID) -> None:
        async with unit_of_work(self._session_factory, self._user.id) as uow:
            await uow.notes.soft_delete(await self._get_or_404(uow.notes, note_id))

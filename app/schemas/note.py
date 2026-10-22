from enum import StrEnum
from typing import Annotated
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
)

from app.models.note import NoteStatus
from app.schemas.category import CategoryRead
from app.schemas.common import UTCDatetime

MAX_OFFSET = 2**63 - 1

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class NoteStatusFilter(StrEnum):
    TODO = NoteStatus.TODO.value
    IN_PROGRESS = NoteStatus.IN_PROGRESS.value
    DONE = NoteStatus.DONE.value
    NONE = "none"


class NoteCreate(BaseModel):
    title: Title
    body: str | None = None
    due: UTCDatetime | None = None
    status: NoteStatus | None = NoteStatus.TODO
    category_ids: list[UUID] = []


class NoteUpdate(BaseModel):
    title: Title = None  # type: ignore[assignment]
    body: str | None = None
    due: UTCDatetime | None = None
    status: NoteStatus | None = None
    category_ids: list[UUID] = None  # type: ignore[assignment]


class NoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    body: str | None
    due: UTCDatetime | None
    status: NoteStatus | None
    categories: list[CategoryRead]
    created_at: UTCDatetime
    updated_at: UTCDatetime


class NoteFilters(BaseModel):
    status: list[NoteStatusFilter] = []
    category_id: list[UUID] = []
    due_from: UTCDatetime | None = None
    due_to: UTCDatetime | None = None
    has_due: bool | None = None
    limit: int = Field(20, ge=1, le=100)
    offset: int = Field(0, ge=0, le=MAX_OFFSET)

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import CurrentUserDep, SessionFactoryDep
from app.api.responses import NOT_FOUND, UNAUTHORIZED, UNPROCESSABLE
from app.schemas.common import Page
from app.schemas.note import NoteCreate, NoteFilters, NoteRead, NoteUpdate
from app.services.note import NoteService

router = APIRouter(prefix="/notes", tags=["notes"], responses=UNAUTHORIZED)


def get_note_service(session_factory: SessionFactoryDep, user: CurrentUserDep) -> NoteService:
    return NoteService(session_factory, user)


NoteServiceDep = Annotated[NoteService, Depends(get_note_service)]


@router.post(
    "", status_code=status.HTTP_201_CREATED, response_model=NoteRead, responses=UNPROCESSABLE
)
async def create_note(data: NoteCreate, service: NoteServiceDep) -> NoteRead:
    return await service.create(data)


@router.get("", response_model=Page[NoteRead])
async def list_notes(
    filters: Annotated[NoteFilters, Query()], service: NoteServiceDep
) -> Page[NoteRead]:
    return await service.search(filters)


@router.get("/{note_id}", response_model=NoteRead, responses=NOT_FOUND)
async def get_note(note_id: UUID, service: NoteServiceDep) -> NoteRead:
    return await service.get(note_id)


@router.patch("/{note_id}", response_model=NoteRead, responses=NOT_FOUND | UNPROCESSABLE)
async def update_note(note_id: UUID, data: NoteUpdate, service: NoteServiceDep) -> NoteRead:
    return await service.update(note_id, data)


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND)
async def delete_note(note_id: UUID, service: NoteServiceDep) -> Response:
    await service.delete(note_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

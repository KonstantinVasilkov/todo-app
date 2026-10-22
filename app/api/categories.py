from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status

from app.api.deps import CurrentUserDep, SessionFactoryDep
from app.api.responses import CONFLICT, NOT_FOUND, UNAUTHORIZED
from app.schemas.category import CategoryCreate, CategoryRead, CategoryUpdate
from app.services.category import CategoryService

router = APIRouter(prefix="/categories", tags=["categories"], responses=UNAUTHORIZED)


def get_category_service(
    session_factory: SessionFactoryDep, user: CurrentUserDep
) -> CategoryService:
    return CategoryService(session_factory, user)


CategoryServiceDep = Annotated[CategoryService, Depends(get_category_service)]


@router.post(
    "", response_model=CategoryRead, status_code=status.HTTP_201_CREATED, responses=CONFLICT
)
async def create_category(data: CategoryCreate, service: CategoryServiceDep) -> CategoryRead:
    return await service.create(data)


@router.get("", response_model=list[CategoryRead])
async def list_categories(service: CategoryServiceDep) -> list[CategoryRead]:
    return await service.list_all()


@router.patch("/{category_id}", response_model=CategoryRead, responses=NOT_FOUND | CONFLICT)
async def update_category(
    category_id: UUID, data: CategoryUpdate, service: CategoryServiceDep
) -> CategoryRead:
    return await service.update(category_id, data)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND)
async def delete_category(category_id: UUID, service: CategoryServiceDep) -> Response:
    await service.delete(category_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

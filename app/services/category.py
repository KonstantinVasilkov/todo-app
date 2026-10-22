from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.exceptions import Conflict, NotFound
from app.models import Category
from app.schemas.category import CategoryCreate, CategoryRead, CategoryUpdate
from app.schemas.user import UserRead
from app.services.uow import unit_of_work


class CategoryService:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession], user: UserRead):
        self._session_factory = session_factory
        self._user = user

    async def create(self, data: CategoryCreate) -> CategoryRead:
        async with unit_of_work(self._session_factory, self._user.id) as uow:
            if await uow.categories.get_or_none(name_key=data.name.casefold()) is not None:
                raise Conflict("Category name already taken", field="name")
            try:
                category = await uow.categories.add(Category(name=data.name))
            except IntegrityError as exc:
                raise Conflict("Category name already taken", field="name") from exc
            return CategoryRead.model_validate(category)

    async def list_all(self) -> list[CategoryRead]:
        async with unit_of_work(self._session_factory, self._user.id) as uow:
            categories = await uow.categories.list()
            return [CategoryRead.model_validate(c) for c in categories]

    async def update(self, category_id: UUID, data: CategoryUpdate) -> CategoryRead:
        async with unit_of_work(self._session_factory, self._user.id) as uow:
            category = await uow.categories.get(category_id)
            if category is None:
                raise NotFound("Category not found")
            existing = await uow.categories.get_or_none(name_key=data.name.casefold())
            if existing is not None and existing.id != category.id:
                raise Conflict("Category name already taken", field="name")
            try:
                await uow.categories.update(category, name=data.name)
            except IntegrityError as exc:
                raise Conflict("Category name already taken", field="name") from exc
            return CategoryRead.model_validate(category)

    async def delete(self, category_id: UUID) -> None:
        async with unit_of_work(self._session_factory, self._user.id) as uow:
            category = await uow.categories.get(category_id)
            if category is None:
                raise NotFound("Category not found")
            await uow.categories.soft_delete(category)
            await uow.notes.remove_category_links(category_id)

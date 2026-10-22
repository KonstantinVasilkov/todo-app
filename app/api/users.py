from fastapi import APIRouter

from app.api.deps import CurrentUserDep
from app.api.responses import UNAUTHORIZED
from app.schemas.user import UserRead

router = APIRouter(prefix="/users", tags=["users"], responses=UNAUTHORIZED)


@router.get("/me", response_model=UserRead)
async def read_me(current_user: CurrentUserDep) -> UserRead:
    return current_user

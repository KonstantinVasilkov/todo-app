from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.common import UTCDatetime


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    email: str
    created_at: UTCDatetime

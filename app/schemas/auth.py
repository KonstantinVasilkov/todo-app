from typing import Annotated, Literal

from pydantic import BaseModel, EmailStr, StringConstraints


class RegisterRequest(BaseModel):
    username: Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_.-]{3,50}$")]
    email: EmailStr
    password: Annotated[str, StringConstraints(min_length=8)]


class Token(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"

from enum import StrEnum
from typing import Any

from pydantic import BaseModel


class DomainErrorType(StrEnum):
    CONFLICT = "conflict"
    INVALID_REFERENCE = "invalid_reference"


class DomainErrorItem(BaseModel):
    loc: list[str | int]
    msg: str
    type: DomainErrorType


class ValidationErrorItem(BaseModel):
    loc: list[str | int]
    msg: str
    type: str
    input: Any = None
    ctx: dict[str, Any] | None = None


class ErrorResponse(BaseModel):
    detail: list[DomainErrorItem | ValidationErrorItem] | str

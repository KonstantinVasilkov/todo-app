from datetime import UTC, datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel


def to_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    try:
        return value.astimezone(UTC)
    except OverflowError as exc:
        raise ValueError("datetime out of range") from exc


UTCDatetime = Annotated[datetime, AfterValidator(to_utc)]


class Page[T](BaseModel):
    items: list[T]
    total: int
    limit: int
    offset: int

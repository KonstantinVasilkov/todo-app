from typing import Any

from app.schemas.errors import ErrorResponse

type Responses = dict[int | str, dict[str, Any]]

UNAUTHORIZED: Responses = {401: {"model": ErrorResponse, "description": "Not authenticated"}}
NOT_FOUND: Responses = {404: {"model": ErrorResponse, "description": "Not found"}}
CONFLICT: Responses = {409: {"model": ErrorResponse, "description": "Conflict with existing data"}}
UNPROCESSABLE: Responses = {
    422: {"model": ErrorResponse, "description": "Validation or reference error"}
}

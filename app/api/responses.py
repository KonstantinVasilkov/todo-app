from app.schemas.errors import ErrorResponse

UNAUTHORIZED = {401: {"model": ErrorResponse, "description": "Not authenticated"}}
NOT_FOUND = {404: {"model": ErrorResponse, "description": "Not found"}}
CONFLICT = {409: {"model": ErrorResponse, "description": "Conflict with existing data"}}
UNPROCESSABLE = {422: {"model": ErrorResponse, "description": "Validation or reference error"}}

from typing import ClassVar


class DomainError(Exception):
    code: ClassVar[str]

    def __init__(self, message: str, *, field: str | None = None):
        super().__init__(message)
        self.message = message
        self.field = field


class NotFound(DomainError):
    code = "not_found"


class Conflict(DomainError):
    code = "conflict"


class InvalidReference(DomainError):
    code = "invalid_reference"


class AuthenticationFailed(DomainError):
    code = "authentication_failed"

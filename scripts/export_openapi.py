import json
import os
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.environ.setdefault("JWT_SECRET", "openapi-export-secret-0123456789abcdef")

from app.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402


def build_schema() -> dict[str, Any]:
    settings = Settings(jwt_secret="openapi-export-secret-0123456789abcdef", _env_file=None)
    return create_app(settings).openapi()


def main() -> None:
    text = json.dumps(build_schema(), indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    (ROOT / "openapi.json").write_text(text)


if __name__ == "__main__":
    main()

import re
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
ALLOWED = "frontend/src/i18n/locales/ru.json"
CYRILLIC = re.compile(
    "["
    + "".join(
        f"{chr(a)}-{chr(b)}"
        for a, b in [(0x400, 0x52F), (0x1C80, 0x1C8F), (0x2DE0, 0x2DFF), (0xA640, 0xA69F)]
    )
    + "]"
)


def test_no_cyrillic_outside_ru_locale() -> None:
    try:
        result = subprocess.run(
            ["git", "ls-files", "-co", "--exclude-standard"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
    except OSError, subprocess.CalledProcessError:
        pytest.skip("git is not available")

    offenders: list[str] = []
    for rel in result.stdout.splitlines():
        if rel == ALLOWED:
            continue
        path = ROOT / rel
        if not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError, OSError:
            continue
        for number, line in enumerate(text.splitlines(), start=1):
            if CYRILLIC.search(line):
                offenders.append(f"{rel}:{number}")

    assert not offenders, "Cyrillic found:\n" + "\n".join(sorted(offenders))

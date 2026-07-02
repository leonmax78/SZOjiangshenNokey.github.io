from __future__ import annotations

import json
from pathlib import Path


FIELDS = [
    "ID",
    "Item",
    "Head",
    "Icon",
    "Name",
    "Bright",
    "Base_Str",
    "Base_Int",
    "Extra_Def",
    "Magic_Def",
    "Base_Con",
    "Base_Dex",
    "Magic_Att",
]
NUMBER_FIELDS = set(FIELDS) - {"Name"}


def parse_changebody(path: Path) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    cur: dict[str, str] = {}

    def push() -> None:
        nonlocal cur
        if not cur.get("Name"):
            cur = {}
            return
        row: dict[str, object] = {}
        for field in FIELDS:
            if field not in cur:
                continue
            if field in NUMBER_FIELDS:
                try:
                    row[field] = int(cur[field], 0)
                except ValueError:
                    row[field] = 0
            else:
                row[field] = cur[field].strip()
        rows.append(row)
        cur = {}

    text = path.read_text(encoding="cp950", errors="replace")
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith(";") or line.startswith("//"):
            continue
        if line.startswith("[") and line.endswith("]"):
            push()
            continue
        if "=" not in line:
            continue
        key, value = [part.strip() for part in line.split("=", 1)]
        if key.upper() == "ID" and "ID" in cur:
            push()
        cur[key] = value
    push()
    return rows


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    rows = parse_changebody(root / "raw" / "CHANGEBODYITEM.INI")
    json_text = json.dumps(rows, ensure_ascii=False, separators=(",", ":"))
    pretty_text = json.dumps(rows, ensure_ascii=False, indent=2) + "\n"
    js_text = (
        "// Generated from raw/CHANGEBODYITEM.INI (CP950).\n"
        f"window.SZO_SOUL_DATA = {json_text};\n"
        "window.SOUL_DATA = window.SZO_SOUL_DATA;\n"
    )
    (root / "js" / "data" / "soul-data.js").write_text(js_text, encoding="utf-8", newline="\n")
    (root / "data" / "soul.json").write_text(pretty_text, encoding="utf-8", newline="\n")
    print(f"souls: {len(rows)}")


if __name__ == "__main__":
    main()

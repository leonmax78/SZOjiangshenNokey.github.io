from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = Path(r"C:\Users\leonm\Desktop\0702\SETTING\COLLECTBOOKBONUS.INI")
NUMERIC_KEYS = ("Value", "Icon", "Con", "Str", "Int", "Dex", "Def", "MDef", "MaxHP", "MaxMP")


def parse_ini(path: Path) -> list[dict[str, str]]:
    text = path.read_bytes().decode("cp950")
    rows: list[dict[str, str]] = []
    cur: dict[str, str] = {}
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("//") or line.startswith(";"):
            continue
        if line.startswith("[") and line.endswith("]"):
            if cur:
                rows.append(cur)
                cur = {}
            continue
        if "=" not in line:
            continue
        key, value = [part.strip() for part in line.split("=", 1)]
        cur[key] = value
    if cur:
        rows.append(cur)
    return rows


def normalize(row: dict[str, str]) -> dict:
    out: dict[str, object] = {}
    for key, value in row.items():
        if key in NUMERIC_KEYS:
            try:
                out[key] = int(value)
            except ValueError:
                out[key] = value
        else:
            out[key] = value
    name = str(out.get("Name", ""))
    match = re.search(r"(\d+)", name)
    out["Level"] = int(match.group(1)) if match else None
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Build data/collectbook_bonus.json from COLLECTBOOKBONUS.INI.")
    parser.add_argument("--source", default=str(DEFAULT_SOURCE))
    parser.add_argument("--out", default=str(ROOT / "data" / "collectbook_bonus.json"))
    args = parser.parse_args()

    source = Path(args.source)
    out = Path(args.out)
    rows = [normalize(row) for row in parse_ini(source)]
    payload = {
        "meta": {
            "source": str(source),
            "count": len(rows),
        },
        "rows": rows,
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {out} ({len(rows)} rows)")


if __name__ == "__main__":
    main()

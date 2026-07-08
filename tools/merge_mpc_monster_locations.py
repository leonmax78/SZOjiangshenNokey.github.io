from __future__ import annotations

import json
from collections import OrderedDict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(r"C:\Users\leonm\Documents\Codex\2026-07-03\id-29622-icon-25575-gicon-35575\outputs\asset_previews\web_monster_locations.json")
DATA = ROOT / "data"


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def write_bundle(path: Path, key: str, data) -> None:
    text = (
        "window.SZO_DATA_BUNDLES=window.SZO_DATA_BUNDLES||{};"
        f"window.SZO_DATA_BUNDLES[{json.dumps(key)}]="
        f"{json.dumps(data, ensure_ascii=False, separators=(',', ':'))};"
    )
    path.write_text(text, encoding="utf-8")


def split_existing_locations(value: str) -> list[str]:
    return [part.strip() for part in str(value or "").split("、") if part.strip()]


def add_location(bucket: OrderedDict[str, None], location: str) -> None:
    location = str(location or "").strip()
    if location:
        bucket.setdefault(location, None)


def tower_location_labels(record: dict) -> list[str]:
    floors = record.get("tower_floors") or []
    labels: list[str] = []
    for floor in floors:
        try:
            labels.append(f"『終末之塔』第{int(floor)}層")
        except Exception:
            continue
    return labels


def stage_location_label(record: dict) -> str:
    stage_name = str(record.get("stage_name") or "").strip()
    return f"『{stage_name}』" if stage_name else ""


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(SOURCE)

    locations_path = DATA / "locations.json"
    locations = read_json(locations_path) if locations_path.exists() else {}
    merged: dict[str, OrderedDict[str, None]] = {}
    for name, text in locations.items():
        bucket: OrderedDict[str, None] = OrderedDict()
        for loc in split_existing_locations(text):
            add_location(bucket, loc)
        merged[str(name)] = bucket

    payload = read_json(SOURCE)
    records = payload.get("records") or []
    for record in records:
        name = str(record.get("monster_name") or "").strip()
        if not name:
            continue
        bucket = merged.setdefault(name, OrderedDict())
        labels = tower_location_labels(record)
        if not labels:
            label = stage_location_label(record)
            if label:
                labels = [label]
        for label in labels:
            add_location(bucket, label)

    out_locations = OrderedDict(
        (name, "、".join(bucket.keys()))
        for name, bucket in sorted(merged.items(), key=lambda item: item[0])
        if bucket
    )

    web_payload = {
        "note": payload.get("note", ""),
        "records": records,
        "manual_locations": payload.get("manual_locations") or [],
    }

    write_json(DATA / "locations.json", out_locations)
    write_bundle(DATA / "locations.bundle.js", "locations", out_locations)
    write_json(DATA / "web_monster_locations.json", web_payload)
    write_bundle(DATA / "web_monster_locations.bundle.js", "web_monster_locations", web_payload)

    search_path = DATA / "search_monsters.bundle.js"
    prefix = 'window.SZO_DATA_BUNDLES=window.SZO_DATA_BUNDLES||{};window.SZO_DATA_BUNDLES["search_monsters"]='
    text = search_path.read_text(encoding="utf-8").strip()
    if not text.startswith(prefix) or not text.endswith(";"):
        raise RuntimeError("unexpected search_monsters.bundle.js format")
    search_data = json.loads(text[len(prefix):-1])
    for row in search_data.get("monsters") or []:
        loc = out_locations.get(str(row.get("name") or ""), "")
        if loc:
            row["location"] = loc
        elif "location" in row:
            del row["location"]
    write_bundle(search_path, "search_monsters", search_data)

    raw_search_json = DATA / "search_monsters.json"
    if raw_search_json.exists():
        write_json(raw_search_json, search_data)

    meta_path = DATA / "build_meta.json"
    if meta_path.exists():
        meta = read_json(meta_path)
        meta.setdefault("counts", {})["locations"] = len(out_locations)
        meta.setdefault("sources", {})["mpc_locations"] = str(SOURCE)
        write_json(meta_path, meta)
        write_bundle(DATA / "build_meta.bundle.js", "build_meta", meta)

    print(f"locations={len(out_locations)}")
    print(f"web_records={len(records)}")


if __name__ == "__main__":
    main()

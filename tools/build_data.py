from __future__ import annotations

import csv
import json
import shutil
from collections import OrderedDict
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "raw"
DATA = ROOT / "data"
REPORTS = ROOT / "reports"
CONFIG = ROOT / "config" / "build_config.json"
MANUAL_DROPS = ROOT / "config" / "manual_drops.json"


def read_text(path: Path) -> str:
    for encoding in ("utf-8-sig", "cp950", "big5", "utf-8"):
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
    return path.read_text(encoding="utf-8", errors="replace")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="")


def load_config() -> dict:
    if not CONFIG.exists():
        return {"git_project_dir": str(ROOT), "copy_to_git_project": False}
    try:
        return json.loads(read_text(CONFIG))
    except Exception:
        return {"git_project_dir": str(ROOT), "copy_to_git_project": False}


def parse_ini_records(text: str) -> list[OrderedDict]:
    records: list[OrderedDict] = []
    cur: OrderedDict | None = None

    def push() -> None:
        nonlocal cur
        if cur and any(k != "_section" for k in cur.keys()):
            records.append(cur)
        cur = None

    for raw in text.replace("\ufeff", "").splitlines():
        line = raw.strip()
        if not line or line.startswith("//") or line.startswith(";"):
            continue
        if line.startswith("[") and line.endswith("]"):
            push()
            cur = OrderedDict()
            cur["_section"] = line[1:-1].strip()
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if key.lower() == "id" and cur and "ID" in cur:
            push()
        if cur is None:
            cur = OrderedDict()
        if key in cur:
            existing = cur[key]
            if isinstance(existing, list):
                existing.append(value)
            else:
                cur[key] = [existing, value]
        else:
            cur[key] = value
    push()
    return records


def record_to_plain(record: OrderedDict) -> dict:
    return {k: v for k, v in record.items() if k != "_section"}


def records_to_ini(records: list[OrderedDict]) -> str:
    out: list[str] = []
    for i, record in enumerate(records):
        section = record.get("_section") or str(record.get("ID") or i + 1)
        out.append(f"[{section}]")
        for key, value in record.items():
            if key == "_section":
                continue
            if isinstance(value, list):
                for one in value:
                    out.append(f"{key} = {one}")
            else:
                out.append(f"{key} = {value}")
        out.append("")
    return "\n".join(out).rstrip() + "\n"


def row_id(row: dict) -> str:
    return str(row.get("ID") or row.get("Id") or row.get("id") or "").strip()


def row_name(row: dict) -> str:
    return str(row.get("Name") or row.get("NAME") or "").strip()


def is_real_named_row(row: dict) -> bool:
    name = row_name(row).strip().upper()
    return bool(name and name not in {"UNKNOWN", "NULL"})


def drop_value(row: dict) -> str:
    value = row.get("DropItem") or row.get("DROPITEM") or row.get("dropitem") or ""
    if isinstance(value, list):
        value = ",".join(str(x) for x in value if str(x).strip())
    return str(value).strip()


def set_drop_value(row: OrderedDict, value: str) -> None:
    if "DropItem" in row:
        row["DropItem"] = value
        return
    row["DropItem"] = value


def parse_drop(drop: str) -> list[dict]:
    nums: list[str] = [x.strip() for x in str(drop or "").split(",") if x.strip()]
    if len(nums) < 4:
        return []
    ordered: list[str] = []
    weights: OrderedDict[str, int] = OrderedDict()
    for i in range(2, len(nums) - 1, 2):
        item_id = nums[i].strip()
        try:
            weight = int(float(nums[i + 1]))
        except ValueError:
            continue
        if not item_id or item_id == "0" or weight <= 0:
            continue
        if item_id not in weights:
            ordered.append(item_id)
            weights[item_id] = 0
        weights[item_id] += weight
    total = sum(weights.values())
    if total <= 0:
        return []
    return [
        {
            "item_id": item_id,
            "weight": weights[item_id],
            "rate": weights[item_id] / total * 100,
        }
        for item_id in ordered
    ]


def has_drop(row: dict) -> bool:
    return bool(parse_drop(drop_value(row)))


def load_merge_rules(path: Path) -> dict:
    if not path.exists():
        return {}
    text = read_text(path)
    rules = {}
    for row in csv.DictReader(text.splitlines()):
        mid = str(row.get("id") or "").strip()
        if not mid:
            continue
        rules[mid] = {
            "old_name": str(row.get("old_name") or "").strip(),
            "new_name": str(row.get("new_name") or "").strip(),
            "action": str(row.get("action") or "").strip().lower(),
            "note": str(row.get("note") or "").strip(),
        }
    return rules


def merge_monsters(new_rows: list[OrderedDict], old_rows: list[OrderedDict]) -> tuple[list[OrderedDict], list[dict]]:
    old_by_id = {row_id(r): r for r in old_rows if row_id(r)}
    rules = load_merge_rules(RAW / "merge_rules.csv")
    merged: list[OrderedDict] = []
    report: list[dict] = []

    for new in new_rows:
        mid = row_id(new)
        old = old_by_id.get(mid)
        new_name = row_name(new)
        old_name = row_name(old) if old else ""
        new_has = has_drop(new)
        old_has = has_drop(old) if old else False
        action = ""
        reason = ""

        out = OrderedDict(new)
        rule = rules.get(mid)
        rule_action = (rule or {}).get("action", "")

        if new_has:
            action = "new_drop_kept"
            reason = "new monster row already has DropItem"
        elif not old_has:
            action = "no_old_drop"
            reason = "old monster row missing or has no valid DropItem"
        elif rule_action == "skip":
            action = "rule_skip"
            reason = (rule or {}).get("note") or "merge_rules.csv says skip"
        elif rule_action == "merge":
            set_drop_value(out, drop_value(old))
            action = "rule_merge"
            reason = (rule or {}).get("note") or "merge_rules.csv says merge"
        elif old and old_name == new_name:
            set_drop_value(out, drop_value(old))
            action = "safe_auto_merge"
            reason = "same ID and same name"
        else:
            action = "name_changed_pending"
            reason = "same ID but name changed; add merge_rules.csv to confirm"

        merged.append(out)
        report.append(
            {
                "monster_id": mid,
                "new_name": new_name,
                "old_name": old_name,
                "new_has_drop": "1" if new_has else "0",
                "old_has_drop": "1" if old_has else "0",
                "action": action,
                "reason": reason,
            }
        )

    return merged, report


def write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def parse_locations(path: Path) -> dict:
    if not path.exists():
        return {}
    text = read_text(path)
    out: dict[str, str] = {}
    sep = "、"

    name_col = "怪物名稱"
    map_col = "地圖名稱"
    id_col = "怪物ID"
    floor_col = "終末樓層"

    def format_location(loc: str, floor: str = "") -> str:
        sep = "、"
        tower = "終末之塔"
        roman_suffix = "ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ"
        loc = str(loc or "").strip().replace("「", "").replace("」", "")
        floor = str(floor or "").strip().replace("「", "").replace("」", "")
        if loc.startswith(tower):
            loc = tower
        else:
            loc = loc.rstrip(roman_suffix)
        if not floor:
            return loc
        floors = [x.strip() for x in floor.split(sep) if x.strip()]
        if not floors:
            return loc
        formatted = []
        for part in floors:
            if not part.startswith("第"):
                part = "第" + part
            formatted.append(f"{loc}{part}")
        return sep.join(formatted)


    def add_location(name: str, loc: str) -> None:
        name = str(name or "").strip()
        loc = str(loc or "").strip()
        if not name or not loc:
            return
        existing = [x.strip() for x in out.get(name, "").split(sep) if x.strip()]
        if loc in existing:
            return
        out[name] = sep.join([*existing, loc])

    rows = list(csv.reader(text.splitlines()))
    if not rows:
        return out
    header = [str(x).strip() for x in rows[0]]
    header_map = {name: idx for idx, name in enumerate(header)}
    if name_col in header_map and map_col in header_map:
        for parts in rows[1:]:
            row = {name: (parts[idx].strip() if idx < len(parts) else "") for name, idx in header_map.items()}
            if row.get("StageID") == "347" and row.get(id_col) == "17986" and row.get("Pic") == "5678":
                continue
            add_location(row.get(name_col, ""), format_location(row.get(map_col, ""), row.get(floor_col, "")))
        return out

    for parts in rows:
        cells = [str(x).strip() for x in parts if str(x).strip()]
        if len(cells) < 2:
            continue
        name = cells[0]
        if name.lower() == "name" or name == name_col:
            continue
        add_location(name, format_location(sep.join(cells[1:])))
    return out

def build_drop_reverse(monsters: list[dict]) -> dict:
    reverse: dict[str, list[dict]] = {}
    for monster in monsters:
        mid = row_id(monster)
        mname = row_name(monster)
        for drop in parse_drop(drop_value(monster)):
            item_id = drop["item_id"]
            reverse.setdefault(item_id, []).append(
                {
                    "monsterId": int(mid) if mid.isdigit() else mid,
                    "monsterName": mname,
                    "rate": drop["rate"],
                    "weight": drop["weight"],
                }
            )
    for item_id, rows in reverse.items():
        dedup: OrderedDict[str, dict] = OrderedDict()
        for row in rows:
            key = str(row["monsterId"])
            if key not in dedup:
                dedup[key] = row
            else:
                dedup[key]["weight"] += row["weight"]
        reverse[item_id] = sorted(dedup.values(), key=lambda x: float(x.get("rate") or 0), reverse=True)
    return reverse


def load_manual_drops() -> list[dict]:
    if not MANUAL_DROPS.exists():
        return []
    try:
        payload = json.loads(read_text(MANUAL_DROPS))
    except Exception:
        return []
    drops = payload.get("drops") if isinstance(payload, dict) else payload
    return drops if isinstance(drops, list) else []


def apply_manual_drops(drop_reverse: dict) -> dict:
    for drop in load_manual_drops():
        item_id = str(drop.get("itemId") or "").strip()
        monster_id = str(drop.get("monsterId") or "").strip()
        monster_name = str(drop.get("monsterName") or "").strip()
        if not item_id or not monster_id or not monster_name:
            continue
        row = {
            "monsterId": int(monster_id) if monster_id.isdigit() else monster_id,
            "monsterName": monster_name,
            "rate": float(drop.get("rate") or 0),
            "weight": int(float(drop.get("weight") or 0)),
            "manual": True,
        }
        rows = [x for x in drop_reverse.get(item_id, []) if str(x.get("monsterId")) != monster_id]
        rows.append(row)
        drop_reverse[item_id] = sorted(rows, key=lambda x: float(x.get("rate") or 0), reverse=True)
    return drop_reverse


def manual_drop_weight(existing_drop: str, item_id: str, rate: float, explicit_weight: int) -> int:
    if explicit_weight > 0:
        return explicit_weight
    if rate <= 0 or rate >= 100:
        return 0
    other_total = 0
    for drop in parse_drop(existing_drop):
        if str(drop.get("item_id")) == item_id:
            continue
        other_total += int(drop.get("weight") or 0)
    if other_total <= 0:
        return 0
    return max(1, int(round((rate * other_total) / (100 - rate))))


def apply_manual_drops_to_monsters(monsters: list[dict]) -> list[dict]:
    rows_by_id = {row_id(monster): monster for monster in monsters}
    drops_by_monster: dict[str, list[dict]] = {}
    for drop in load_manual_drops():
        monster_id = str(drop.get("monsterId") or "").strip()
        item_id = str(drop.get("itemId") or "").strip()
        if monster_id and item_id:
            drops_by_monster.setdefault(monster_id, []).append(drop)
    for monster_id, manual_drops in drops_by_monster.items():
        monster = rows_by_id.get(monster_id)
        if not monster:
            continue
        current = drop_value(monster)
        parts = [x.strip() for x in current.split(",") if x.strip()]
        if len(parts) < 2:
            parts = ["1", "0"]
        prefix = parts[:2]
        manual_item_ids = {str(drop.get("itemId") or "").strip() for drop in manual_drops}
        pairs: list[tuple[str, int]] = []
        replaced_items: set[str] = set()
        for i in range(2, len(parts) - 1, 2):
            iid = parts[i].strip()
            try:
                weight = int(float(parts[i + 1]))
            except ValueError:
                continue
            if iid in manual_item_ids:
                replaced_items.add(iid)
                continue
            if iid and iid != "0" and weight > 0:
                pairs.append((iid, weight))
        other_total = sum(weight for _, weight in pairs)
        target_rates = {
            str(drop.get("itemId") or "").strip(): float(drop.get("rate") or 0)
            for drop in manual_drops
            if float(drop.get("rate") or 0) > 0
        }
        rate_total = sum(target_rates.values())
        for drop in manual_drops:
            item_id = str(drop.get("itemId") or "").strip()
            explicit_weight = int(float(drop.get("weight") or 0))
            if explicit_weight > 0:
                weight = explicit_weight
            elif other_total > 0 and 0 < rate_total < 100:
                weight = max(1, int(round((target_rates.get(item_id, 0) * other_total) / (100 - rate_total))))
            else:
                weight = manual_drop_weight(current, item_id, target_rates.get(item_id, 0), explicit_weight)
            if weight > 0:
                pairs.append((item_id, weight))
        added_count = len([drop for drop in manual_drops if str(drop.get("itemId") or "").strip() not in replaced_items])
        if added_count:
            try:
                prefix[1] = str(int(float(prefix[1])) + added_count)
            except ValueError:
                prefix[1] = str(len(pairs))
        flattened = prefix[:]
        for iid, weight in pairs:
            flattened.extend([iid, str(weight)])
        monster["DropItem"] = ",".join(flattened)
    return monsters


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def write_runtime_data_js(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    path.write_text("window.SZO_JSON_DATA=" + body + ";\n", encoding="utf-8")


def write_data_bundle_js(path: Path, key: str, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    path.write_text(
        "window.SZO_DATA_BUNDLES=window.SZO_DATA_BUNDLES||{};"
        f"window.SZO_DATA_BUNDLES[{json.dumps(key)}]={body};\n",
        encoding="utf-8",
    )


def write_drop_reverse_shards(drop_reverse: dict) -> None:
    shard_dir = DATA / "drop_reverse_shards"
    shard_dir.mkdir(parents=True, exist_ok=True)
    for old in shard_dir.glob("*.json"):
        old.unlink()
    shards: dict[str, dict] = {}
    for item_id, rows in drop_reverse.items():
        prefix = str(item_id)[:3] or "misc"
        shards.setdefault(prefix, {})[str(item_id)] = rows
    for prefix, rows in shards.items():
        write_json(shard_dir / f"{prefix}.json", rows)
    write_json(
        shard_dir / "manifest.json",
        {
            "prefixLength": 3,
            "count": len(shards),
            "shards": sorted(shards.keys()),
        },
    )


def copy_outputs_to_project(config: dict) -> None:
    if not config.get("copy_to_git_project"):
        return
    target = Path(str(config.get("git_project_dir") or "")).expanduser()
    if not target:
        return
    target.mkdir(parents=True, exist_ok=True)
    for folder in ("data", "reports"):
        src = ROOT / folder
        dst = target / folder
        dst.mkdir(parents=True, exist_ok=True)
        for file in src.glob("*"):
            if file.is_file():
                shutil.copy2(file, dst / file.name)
    merged = RAW / "MONSTER_C_MERGED.INI"
    if merged.exists():
        (target / "raw").mkdir(parents=True, exist_ok=True)
        shutil.copy2(merged, target / "raw" / merged.name)


def main() -> None:
    DATA.mkdir(exist_ok=True)
    REPORTS.mkdir(exist_ok=True)

    new_monster_path = RAW / "new" / "MONSTER_C.INI"
    old_monster_path = RAW / "old" / "MONSTER_C.INI"
    item_path = RAW / "ITEM.INI"
    magic_path = RAW / "MAGIC.INI"
    compound_path = RAW / "COMPOUN.INI"
    status_path = RAW / "STATUS.INI"
    location_path = RAW / "一般怪物位置.csv"

    new_monsters = [x for x in parse_ini_records(read_text(new_monster_path)) if is_real_named_row(x)]
    old_monsters = [x for x in parse_ini_records(read_text(old_monster_path)) if is_real_named_row(x)] if old_monster_path.exists() else []
    merged_monsters, report = merge_monsters(new_monsters, old_monsters)

    merged_ini = records_to_ini(merged_monsters)
    write_text(RAW / "MONSTER_C_MERGED.INI", merged_ini)

    items = [record_to_plain(x) for x in parse_ini_records(read_text(item_path)) if is_real_named_row(x)]
    monsters = [record_to_plain(x) for x in merged_monsters]
    monsters = apply_manual_drops_to_monsters(monsters)
    magic = [record_to_plain(x) for x in parse_ini_records(read_text(magic_path))]
    compound = [record_to_plain(x) for x in parse_ini_records(read_text(compound_path))]
    status = [record_to_plain(x) for x in parse_ini_records(read_text(status_path))]
    locations = parse_locations(location_path)
    drop_reverse = apply_manual_drops(build_drop_reverse(monsters))

    search_index = {
        "items": [
            {
                "id": row_id(x),
                "name": row_name(x),
                "type": x.get("Type", ""),
                "level": x.get("Level", ""),
            }
            for x in items
        ],
        "monsters": [
            {
                "id": row_id(x),
                "name": row_name(x),
                "level": x.get("Level", ""),
                "type": x.get("Type", ""),
                "subType": x.get("SubType", ""),
                "exp": x.get("DropExp", ""),
            }
            for x in monsters
        ],
    }
    build_meta = {
        "built_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "counts": {
            "items": len(items),
            "monsters": len(monsters),
            "magic": len(magic),
            "compound": len(compound),
            "status": len(status),
            "locations": len(locations),
            "drop_reverse": len(drop_reverse),
        },
        "sources": {
            "new_monster": str(new_monster_path.relative_to(ROOT)).replace("\\", "/"),
            "old_monster": str(old_monster_path.relative_to(ROOT)).replace("\\", "/"),
            "items": str(item_path.relative_to(ROOT)).replace("\\", "/"),
            "magic": str(magic_path.relative_to(ROOT)).replace("\\", "/"),
            "compound": str(compound_path.relative_to(ROOT)).replace("\\", "/"),
            "status": str(status_path.relative_to(ROOT)).replace("\\", "/"),
            "locations": str(location_path.relative_to(ROOT)).replace("\\", "/"),
        },
    }

    write_json(DATA / "items.json", items)
    write_json(DATA / "monsters.json", monsters)
    write_json(DATA / "magic.json", magic)
    write_json(DATA / "compound.json", compound)
    write_json(DATA / "status.json", status)
    write_json(DATA / "locations.json", locations)
    write_json(DATA / "drop_reverse.json", drop_reverse)
    write_drop_reverse_shards(drop_reverse)
    write_json(DATA / "search_index.json", search_index)
    write_json(DATA / "build_meta.json", build_meta)
    write_data_bundle_js(DATA / "items.bundle.js", "items", items)
    write_data_bundle_js(DATA / "monsters.bundle.js", "monsters", monsters)
    write_data_bundle_js(DATA / "magic.bundle.js", "magic", magic)
    write_data_bundle_js(DATA / "status.bundle.js", "status", status)
    write_data_bundle_js(DATA / "locations.bundle.js", "locations", locations)
    write_data_bundle_js(DATA / "drop_reverse.bundle.js", "drop_reverse", drop_reverse)
    write_data_bundle_js(DATA / "search_index.bundle.js", "search_index", search_index)
    write_data_bundle_js(DATA / "search_items.bundle.js", "search_items", {"items": search_index["items"]})
    write_data_bundle_js(DATA / "search_monsters.bundle.js", "search_monsters", {"monsters": search_index["monsters"]})
    write_data_bundle_js(DATA / "build_meta.bundle.js", "build_meta", build_meta)
    write_runtime_data_js(
        DATA / "runtime-data.js",
        {
            "items": items,
            "monsters": monsters,
            "magic": magic,
            "status": status,
            "locations": locations,
        },
    )

    report_path = REPORTS / "monster_drop_merge_report.csv"
    write_csv(
        report_path,
        report,
        ["monster_id", "new_name", "old_name", "new_has_drop", "old_has_drop", "action", "reason"],
    )

    copy_outputs_to_project(load_config())

    print(f"道具：{len(items)} 筆")
    print(f"怪物：{len(monsters)} 筆")
    print(f"技能：{len(magic)} 筆")
    print(f"合成：{len(compound)} 筆")
    print(f"狀態：{len(status)} 筆")
    print(f"位置：{len(locations)} 筆")
    print(f"掉落反查：{len(drop_reverse)} 筆")
    print(f"合併報告：{report_path.as_posix()}")


if __name__ == "__main__":
    main()

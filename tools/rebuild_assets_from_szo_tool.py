from __future__ import annotations

import argparse
import importlib.util
import json
import shutil
from collections import OrderedDict
from pathlib import Path


def load_tool(path: Path):
    spec = importlib.util.spec_from_file_location("szo_asset_tool_external", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load tool: {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def write_png(img, path: Path, trim_func) -> bool:
    path.parent.mkdir(parents=True, exist_ok=True)
    out = trim_func(img).convert("RGBA")
    if not out.getbbox():
        return False
    out.save(path)
    return True


def parse_monster_objects(tool, setting_root: Path):
    sources = [
        setting_root / "SETTING" / "MONSTER.OBD",
        setting_root / "SETTING" / "MONSTER2.OBD",
        setting_root / "SETTING" / "NPC.OBD",
        setting_root / "DATA1" / "setting" / "monster.obd",
        setting_root / "DATA1" / "setting" / "monster2.obd",
        setting_root / "DATA1" / "setting" / "npc.obd",
    ]
    by_sequence: dict[str, list[OrderedDict[str, object]]] = {}
    for source in sources:
        for obj in tool.parse_obd_objects(source):
            obj["_Source"] = source.name
            seq = str(obj.get("Sequence", "")).strip()
            if seq:
                by_sequence.setdefault(seq, []).append(obj)
    return by_sequence


def resolve_monster_object(tool, monster: dict[str, object], by_sequence):
    pic = str(monster.get("Pic", "")).strip()
    monster_id = tool.row_id(monster)
    override_seq = tool.MONSTER_SEQUENCE_OVERRIDES.get(monster_id)
    if override_seq and by_sequence.get(override_seq):
        return by_sequence[override_seq][0]
    candidates = by_sequence.get(pic) or []
    if not candidates:
        return None
    if tool.is_container_monster(monster):
        for obj in candidates:
            if tool.object_uses_sprite(obj, "chest"):
                return obj
        for obj in candidates:
            if "寶箱" in tool.row_name(obj):
                return obj
    return candidates[0]


def find_itemwnd_icon_file_split(tool, setting_root: Path, asset_root: Path, icon_id: int, prefix: str = "i"):
    entry = tool.itemwnd_icon_map(setting_root).get(icon_id)
    if not entry:
        return None
    normal = (entry.get("Normal") or "").strip()
    if not normal or normal.lower() == "normal":
        return None
    stem = Path(normal).stem
    dir_value = (entry.get("Dir") or r"\item\\").replace("/", "\\").strip("\\")
    candidates: list[Path] = []
    if dir_value:
        candidates.extend([
            asset_root / "SHAPE" / dir_value / stem,
            asset_root / "DATA8" / "shape" / dir_value / stem,
            asset_root / "DATA7" / "shape" / dir_value / stem,
            asset_root / "DATA6" / "shape" / dir_value / stem,
            asset_root / "DATA5" / "shape" / dir_value / stem,
            asset_root / "DATA4" / "shape" / dir_value / stem,
            asset_root / "DATA3" / "shape" / dir_value / stem,
            asset_root / "DATA2" / "shape" / dir_value / stem,
            asset_root / "DATA1" / "shape" / dir_value / stem,
        ])
    if prefix.lower() in ("i", "g") and stem[:1].lower() != prefix.lower():
        alt_stem = prefix.lower() + stem[1:] if stem else stem
        candidates.extend([
            asset_root / "SHAPE" / "ITEM" / alt_stem,
            asset_root / "DATA8" / "shape" / "item" / alt_stem,
            asset_root / "DATA7" / "shape" / "item" / alt_stem,
            asset_root / "DATA6" / "shape" / "item" / alt_stem,
            asset_root / "DATA5" / "shape" / "item" / alt_stem,
            asset_root / "DATA4" / "shape" / "item" / alt_stem,
            asset_root / "DATA3" / "shape" / "item" / alt_stem,
            asset_root / "DATA2" / "shape" / "item" / alt_stem,
            asset_root / "DATA1" / "shape" / "item" / alt_stem,
        ])
    for base in candidates:
        for ext in (".SHP", ".shp", ".PNG", ".png"):
            path = base.with_suffix(ext)
            if path.exists():
                return path, entry
    return None


def rebuild_item_icons(tool, setting_root: Path, asset_root: Path, out_dir: Path):
    items = tool.parse_ini_records(setting_root / "SETTING" / "ITEM.INI")
    wanted: OrderedDict[str, dict[str, str]] = OrderedDict()
    for item in items:
        icon_id = tool.int_or_none(item.get("Icon"))
        if icon_id is None:
            continue
        suffix = f"{icon_id % 10000:04d}"
        wanted.setdefault(suffix, item)

    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    written: list[str] = []
    missing: list[tuple[str, str]] = []
    for suffix, item in wanted.items():
        icon_id = tool.int_or_none(item.get("Icon"))
        if icon_id is None:
            continue
        frames = None
        hit = find_itemwnd_icon_file_split(tool, setting_root, asset_root, icon_id, "i")
        if hit:
            path, entry = hit
            frames = tool.load_shape(path)
            attrib = (entry.get("Attrib") or "").upper()
            misc = tool.int_or_none(entry.get("MiscAttrib"))
            if "ICON_ATTRIB_TABLE" in attrib and misc is not None:
                frames = [tool.apply_stable_table(frame, misc, asset_root) for frame in frames]
        if not frames:
            path = tool.find_icon_file(asset_root, icon_id, "i", str(item.get("Type", "")))
            if path:
                frames = tool.load_shape(path)
        if not frames:
            missing.append((suffix, tool.row_name(item)))
            continue
        if write_png(frames[0], out_dir / f"i{suffix}.png", tool.trim_visible):
            written.append(suffix)
    return written, missing


def rebuild_monster_portraits(tool, setting_root: Path, asset_root: Path, out_dir: Path):
    monsters = tool.parse_ini_records(setting_root / "SETTING" / "MONSTER_C.INI")
    by_sequence = parse_monster_objects(tool, setting_root)
    wanted: OrderedDict[str, dict[str, str]] = OrderedDict()
    id_overrides: OrderedDict[str, dict[str, str]] = OrderedDict()
    for monster in monsters:
        pic = str(monster.get("Pic", "")).strip()
        if pic:
            wanted.setdefault(pic, monster)
        if tool.row_id(monster) in {"15714"}:
            id_overrides[tool.row_id(monster)] = monster

    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    written: list[str] = []
    missing: list[tuple[str, str]] = []
    for pic, monster in wanted.items():
        obj = resolve_monster_object(tool, monster, by_sequence)
        candidate = tool.load_monster_portrait_candidate(asset_root, pic, obj)
        if not candidate:
            missing.append((pic, tool.row_name(monster)))
            continue
        frame, _frame_index, _path, _action = candidate
        if write_png(frame, out_dir / f"m{pic}.png", tool.trim_visible):
            written.append(pic)

    for monster_id, monster in id_overrides.items():
        pic = str(monster.get("Pic", "")).strip()
        obj = resolve_monster_object(tool, monster, by_sequence)
        candidate = tool.load_monster_portrait_candidate(asset_root, pic, obj)
        if candidate and write_png(candidate[0], out_dir / f"m{monster_id}.png", tool.trim_visible):
            written.append(monster_id)
    return written, missing


def rebuild_soul_portraits(tool, setting_root: Path, asset_root: Path, out_dir: Path):
    rows = tool.parse_ini_records(setting_root / "SETTING" / "CHANGEBODYITEM.INI")
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    written: list[str] = []
    missing: list[tuple[str, str]] = []
    for row in rows:
        soul_id = tool.row_id(row)
        path = tool.changebody_portrait_file(asset_root, row)
        if not soul_id or not path:
            missing.append((soul_id, tool.row_name(row)))
            continue
        frames = tool.load_shape(path)
        if not frames:
            missing.append((soul_id, tool.row_name(row)))
            continue
        if write_png(frames[0], out_dir / f"s{soul_id}.png", tool.trim_visible):
            written.append(soul_id)
    return written, missing


def write_manifest(base_dir: Path, version: str, items: list[str], monsters: list[str], souls: list[str], missing: dict):
    manifest = {
        "version": version,
        "base": "assets/test-media",
        "itemIcons": sorted(set(items)),
        "monsterPics": sorted(set(monsters), key=lambda x: (len(x), x)),
        "soulIds": sorted(set(souls), key=lambda x: int(x) if str(x).isdigit() else 999999),
        "counts": {
            "itemIcons": len(set(items)),
            "monsterPics": len(set(monsters)),
            "soulPortraits": len(set(souls)),
            "itemMissing": len(missing["items"]),
            "monsterMissing": len(missing["monsters"]),
            "soulMissing": len(missing["souls"]),
        },
        "missing": missing,
    }
    data_dir = base_dir / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / "asset_manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (data_dir / "asset_manifest.bundle.js").write_text(
        "window.SZO_DATA_BUNDLES=window.SZO_DATA_BUNDLES||{};"
        "window.SZO_DATA_BUNDLES.asset_manifest="
        + json.dumps(manifest, ensure_ascii=False, separators=(",", ":"))
        + ";",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tool", default=r"C:\Users\leonm\Desktop\新增資料夾\SZOAssetTool_TABLE_exact_test.pyw")
    parser.add_argument("--setting-root", default=r"C:\Users\leonm\Desktop\0709")
    parser.add_argument("--asset-root", default=r"C:\Users\leonm\Desktop\0702")
    parser.add_argument("--site-root", default=".")
    parser.add_argument("--version", default="assets-0715-table-exact-v404")
    args = parser.parse_args()

    tool = load_tool(Path(args.tool))
    setting_root = Path(args.setting_root)
    asset_root = Path(args.asset_root)
    site_root = Path(args.site_root)
    media_root = site_root / "assets" / "test-media"
    tmp_root = site_root / "tmp" / "rebuilt-assets"
    if tmp_root.exists():
        shutil.rmtree(tmp_root)

    items, item_missing = rebuild_item_icons(tool, setting_root, asset_root, tmp_root / "item-icons")
    monsters, monster_missing = rebuild_monster_portraits(tool, setting_root, asset_root, tmp_root / "monster-portraits")
    souls, soul_missing = rebuild_soul_portraits(tool, setting_root, asset_root, tmp_root / "soul-portraits")
    if len(items) < 1000 or len(monsters) < 1000 or len(souls) < 50:
        raise RuntimeError(
            f"Rebuilt asset count is too low: items={len(items)}, monsters={len(monsters)}, souls={len(souls)}"
        )
    for name in ("item-icons", "monster-portraits", "soul-portraits"):
        target = media_root / name
        if target.exists():
            shutil.rmtree(target)
        shutil.move(str(tmp_root / name), str(target))
    missing = {
        "items": item_missing,
        "monsters": monster_missing,
        "souls": soul_missing,
    }
    write_manifest(site_root, args.version, items, monsters, souls, missing)
    print(json.dumps({
        "items": len(items),
        "itemMissing": len(item_missing),
        "monsters": len(monsters),
        "monsterMissing": len(monster_missing),
        "souls": len(souls),
        "soulMissing": len(soul_missing),
        "version": args.version,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

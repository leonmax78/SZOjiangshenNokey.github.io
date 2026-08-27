from __future__ import annotations

import argparse
import importlib.util
import json
import shutil
from pathlib import Path


DEFAULT_OVERLAY = Path(
    r"C:\Users\leonm\Documents\Codex\2026-07-03\id-29622-icon-25575-gicon-35575\outputs\stage_map_overlay.py"
)
DEFAULT_ASSET_TOOL = DEFAULT_OVERLAY.with_name("SZOAssetTool.pyw")


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site-root", type=Path, default=Path.cwd())
    parser.add_argument("--update-root", type=Path, default=Path(r"C:\Users\leonm\Desktop\0827"))
    parser.add_argument("--asset-root", type=Path, default=Path(r"C:\Users\leonm\Desktop\0702"))
    parser.add_argument("--overlay", type=Path, default=DEFAULT_OVERLAY)
    parser.add_argument("--asset-tool", type=Path, default=DEFAULT_ASSET_TOOL)
    args = parser.parse_args()

    site_root = args.site_root.resolve()
    stage_data = json.loads((site_root / "data" / "stage_maps.json").read_text(encoding="utf-8"))
    monster_ids_by_pic: dict[str, int] = {}
    npc_ids_by_pic: dict[str, int] = {}
    for stage in stage_data.get("stages", []):
        for row in stage.get("monsters", []):
            monster_ids_by_pic.setdefault(str(row.get("pic")), int(row.get("id")))
        for row in stage.get("npcs", []):
            npc_ids_by_pic.setdefault(str(row.get("pic")), int(row.get("id")))

    overlay = load_module("stage_map_overlay_front_batch", args.overlay)
    overlay.ROOT = args.update_root
    tool = load_module("szo_asset_tool_front_batch", args.asset_tool)
    rebuild = load_module("rebuild_assets_front_batch", site_root / "tools" / "rebuild_assets_from_szo_tool.py")

    original_resolve = tool.resolve_shape_file

    def resolve_shape_file(_root, directory, name):
        return original_resolve(args.update_root, directory, name) or original_resolve(args.asset_root, directory, name)

    tool.resolve_shape_file = resolve_shape_file
    npc_objects = overlay.build_npc_object_index(tool)
    monster_objects = rebuild.parse_monster_objects(tool, args.update_root)
    monster_rows = tool.parse_ini_records(args.update_root / "SETTING" / "MONSTER_C.INI")
    monster_by_pic: dict[str, dict[str, str]] = {}
    for row in monster_rows:
        pic = str(row.get("Pic", "")).strip()
        if pic:
            monster_by_pic.setdefault(pic, row)

    temp_root = site_root / "tmp" / "front-map-portraits"
    if temp_root.exists():
        shutil.rmtree(temp_root)
    temp_root.mkdir(parents=True)
    monster_out = temp_root / "monster-portraits"
    npc_out = temp_root / "npc-portraits"
    monster_out.mkdir()
    npc_out.mkdir()

    monster_written: list[str] = []
    monster_missing: list[str] = []
    for pic in sorted(monster_ids_by_pic, key=lambda value: int(value)):
        monster = monster_by_pic.get(pic)
        if monster is None:
            monster_missing.append(pic)
            continue
        obj = rebuild.resolve_monster_object(tool, monster, monster_objects)
        candidate = tool.load_monster_portrait_candidate(args.asset_root, pic, obj)
        if candidate and rebuild.write_png(candidate[0], monster_out / f"m{pic}.png", tool.trim_visible):
            monster_written.append(pic)
        else:
            monster_missing.append(pic)

    npc_written: list[str] = []
    npc_monster_fallback: list[str] = []
    npc_missing: list[str] = []
    for pic in sorted(npc_ids_by_pic, key=lambda value: int(value)):
        result = overlay.load_npc_sprite(tool, npc_objects, int(pic), npc_ids_by_pic[pic])
        if result is None:
            monster_source = monster_out / f"m{pic}.png"
            if not monster_source.exists():
                monster_source = site_root / "assets" / "test-media" / "monster-portraits" / f"m{pic}.png"
            if monster_source.exists():
                shutil.copy2(monster_source, npc_out / f"n{pic}.png")
                npc_written.append(pic)
                npc_monster_fallback.append(pic)
                continue
            npc_missing.append(pic)
            continue
        result[0].save(npc_out / f"n{pic}.png")
        npc_written.append(pic)

    targets = {
        monster_out: site_root / "assets" / "test-media" / "monster-portraits",
        npc_out: site_root / "assets" / "test-media" / "npc-portraits",
    }
    for source_dir, target_dir in targets.items():
        target_dir.mkdir(parents=True, exist_ok=True)
        for source in source_dir.glob("*.png"):
            shutil.copy2(source, target_dir / source.name)

    report = {
        "monsterRequested": len(monster_ids_by_pic),
        "monsterWritten": len(monster_written),
        "monsterMissing": monster_missing,
        "npcRequested": len(npc_ids_by_pic),
        "npcWritten": len(npc_written),
        "npcMonsterFallback": npc_monster_fallback,
        "npcMissing": npc_missing,
    }
    report_path = site_root / "reports" / "map_portraits_front_rebuild.json"
    report_path.parent.mkdir(exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

from __future__ import annotations

import argparse
import importlib.util
import json
import re
from pathlib import Path


DEFAULT_OVERLAY = Path(
    r"C:\Users\leonm\Documents\Codex\2026-07-03\id-29622-icon-25575-gicon-35575\outputs\stage_map_overlay.py"
)

FLOORS_171_180 = {
    18178: [171, 172],
    18179: [171, 172],
    18180: [173],
    18182: [174],
    18183: [174],
    18181: [175],
    18185: [176],
    18186: [177],
    18184: [178],
    18187: [179],
    18188: [180],
}


def load_module(path: Path):
    spec = importlib.util.spec_from_file_location("szo_stage_map_overlay_0903", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def marker(row: dict[str, object], scale: int, floor_map: dict[int, list[int]] | None = None) -> dict[str, object]:
    raw_x = int(row["x"])
    raw_y = int(row["y"])
    result: dict[str, object] = {
        "kind": str(row["kind"]),
        "id": int(row["id"]),
        "name": str(row.get("name") or ""),
        "pic": int(row["pic"]),
        "level": row.get("level", ""),
        "x": int(round(raw_x / 16 * scale)),
        "y": int(round(raw_y / 16 * scale)),
        "rawX": raw_x,
        "rawY": raw_y,
        "coordX": int(round(raw_x / 16)),
        "coordY": int(round(raw_y / 16)),
    }
    if floor_map and int(row["id"]) in floor_map:
        result["tower_floors"] = floor_map[int(row["id"])]
        result["floor"] = floor_map[int(row["id"])][0]
    if row["kind"] == "npc":
        result["role"] = str(row.get("npc_role") or "normal")
        result["shop"] = str(row.get("shop") or "")
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site-root", type=Path, default=Path.cwd())
    parser.add_argument("--update-root", type=Path, default=Path(r"C:\Users\leonm\Desktop\0903"))
    parser.add_argument("--base-root", type=Path, default=Path(r"C:\Users\leonm\Desktop\0702"))
    parser.add_argument("--overlay", type=Path, default=DEFAULT_OVERLAY)
    args = parser.parse_args()

    site_root = args.site_root.resolve()
    overlay = load_module(args.overlay)
    overlay.ROOT = args.update_root.resolve()
    base_root = args.base_root.resolve()

    def iter_combined_data_dirs():
        return [
            overlay.ROOT / "SHAPE",
            *(overlay.ROOT / f"DATA{i}" / "shape" for i in range(1, 9)),
            base_root / "SHAPE",
            *(base_root / f"DATA{i}" / "shape" for i in range(1, 9)),
        ]

    overlay.iter_data_dirs = iter_combined_data_dirs

    def build_combined_static_object_index(tool):
        result = {}
        sources = []
        for setting_dir in (base_root / "DATA1" / "setting", overlay.ROOT / "SETTING"):
            if not setting_dir.exists():
                continue
            for pattern in ("raser*.obd", "object*.obd", "server.obd", "wlight*.obd"):
                sources.extend(setting_dir.glob(pattern))
        for source in sources:
            for obj in tool.parse_obd_objects(source):
                seq = str(obj.get("Sequence", "")).strip()
                if not seq.isdigit():
                    continue
                flags = str(obj.get("Flags") or "")
                seq_int = int(seq)
                if "STATIC" not in flags and seq_int != 10001 and not 16 <= seq_int <= 23:
                    continue
                obj["_Source"] = str(source)
                result[seq_int] = obj
        return result

    overlay.build_static_object_index = build_combined_static_object_index

    def load_update_tile_library():
        if overlay.MAP_TILE_CACHE is not None:
            return overlay.MAP_TILE_CACHE
        base_map_dir = base_root / "DATA1" / "map"
        update_map_dir = overlay.ROOT / "MAP"
        files = [base_map_dir / "area01.gic"]
        base_icons = sorted(
            base_map_dir.glob("icon*.2ic"),
            key=lambda path: int(re.search(r"(\d+)", path.stem).group(1))
            if re.search(r"(\d+)", path.stem)
            else 0,
        )
        for base_icon in base_icons:
            update_icon = update_map_dir / base_icon.name.upper()
            files.append(update_icon if update_icon.exists() else base_icon)
        tiles = {}
        groups = []
        global_base = 0
        seen = set()
        for path in files:
            if not path.exists() or path.resolve() in seen:
                continue
            seen.add(path.resolve())
            part_tiles, part_groups, count = overlay.load_iref_tiles(path, global_base)
            tiles.update(part_tiles)
            groups.extend(part_groups)
            global_base += count
        overlay.MAP_TILE_CACHE = (tiles, groups)
        return overlay.MAP_TILE_CACHE

    overlay.load_map_tile_library = load_update_tile_library
    context = overlay.build_render_context()
    tool = context["tool"]
    original_resolve = tool.resolve_shape_file

    def resolve_shape_file(_root, directory, name):
        return original_resolve(overlay.ROOT, directory, name) or original_resolve(base_root, directory, name)

    tool.resolve_shape_file = resolve_shape_file
    monsters = context["monsters"]
    npcs = context["npcs"]
    stage_names = context["stage_names"]

    data_path = site_root / "data" / "stage_maps.json"
    payload = json.loads(data_path.read_text(encoding="utf-8"))
    by_id = {int(stage["stageId"]): stage for stage in payload["stages"]}
    png_dir = site_root / "assets" / "test-media" / "stage-maps"
    webp_dir = site_root / "assets" / "test-media" / "stage-maps-webp"
    png_dir.mkdir(parents=True, exist_ok=True)
    webp_dir.mkdir(parents=True, exist_ok=True)

    report = []
    for stage_id in (347, 348, 393):
        canvas, _ = overlay.compose_stage_map(
            stage_id,
            context,
            show_monsters=False,
            show_npcs=False,
        )
        base = overlay.find_map_image(context["tool"], stage_id)
        scale = 2
        width, height = base.width * scale, base.height * scale
        map_image = canvas.crop((0, 0, width, height)).convert("RGB")
        map_image.save(png_dir / f"stage{stage_id:03d}.png", optimize=True)
        map_image.save(webp_dir / f"stage{stage_id:03d}.webp", format="WEBP", quality=88, method=6)

        monster_rows = overlay.parse_stage_objects(stage_id, monsters)
        npc_rows = overlay.parse_stage_npcs(stage_id, npcs)
        floor_map = FLOORS_171_180 if stage_id == 348 else None
        entry = {
            "stageId": stage_id,
            "stageName": str(stage_names[stage_id]),
            "image": f"assets/test-media/stage-maps-webp/stage{stage_id:03d}.webp",
            "width": width,
            "height": height,
            "monsters": [marker(row, scale, floor_map) for row in monster_rows],
            "npcs": [marker(row, scale) for row in npc_rows],
            "scale": scale,
        }
        by_id[stage_id] = entry
        report.append({"stageId": stage_id, "width": width, "height": height, "monsters": len(monster_rows), "npcs": len(npc_rows)})

    payload["version"] = "stage-map-0903-tower-xviii"
    payload["excludedStageIds"] = [sid for sid in payload.get("excludedStageIds", []) if sid != 348]
    payload["stages"] = [by_id[sid] for sid in sorted(by_id)]
    data_path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    index_path = site_root / "data" / "stage_map_index.json"
    index = json.loads(index_path.read_text(encoding="utf-8"))
    index["version"] = "stage-map-index-0903"
    index["stages"] = [
        {"stageId": int(stage["stageId"]), "stageName": str(stage["stageName"])}
        for stage in payload["stages"]
    ]
    index_path.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    report_path = site_root / "reports" / "stage_map_0903_update.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

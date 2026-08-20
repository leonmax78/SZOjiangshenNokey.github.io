import json
import sys
from pathlib import Path


STAGE_ID = 288

# Confirmed from the map blocks and their monster groups. The stage image uses
# one coordinate plane containing ten disconnected floors.
FLOOR_CENTERS = {
    41: (958, 156),
    42: (1518, 120),
    43: (1474, 432),
    44: (1136, 664),
    45: (1124, 980),
    46: (572, 946),
    47: (778, 516),
    48: (210, 702),
    49: (488, 308),
    50: (154, 90),
}


def nearest_area(x, y, areas):
    return min(areas, key=lambda area: (x - area["x"]) ** 2 + (y - area["y"]) ** 2)


def infer_area_floors(stage):
    areas = stage["areas"]
    floors = sorted(area["floor"] for area in areas)
    votes = [{floor: 0 for floor in floors} for _ in areas]

    for marker in stage.get("monsters", []) + stage.get("npcs", []):
        floor = marker.get("floor")
        if floor not in floors:
            continue
        area = nearest_area(marker["x"], marker["y"], areas)
        votes[areas.index(area)][floor] += 1

    # Assign each floor to exactly one disconnected map block. A small bonus
    # retains the current label when monster evidence is tied or absent.
    states = {0: (0.0, [])}
    for area_index, area in enumerate(areas):
        next_states = {}
        for mask, (score, assignment) in states.items():
            for floor_index, floor in enumerate(floors):
                bit = 1 << floor_index
                if mask & bit:
                    continue
                candidate = score + votes[area_index][floor]
                if area.get("floor") == floor:
                    candidate += 0.01
                new_mask = mask | bit
                if new_mask not in next_states or candidate > next_states[new_mask][0]:
                    next_states[new_mask] = (candidate, assignment + [floor])
        states = next_states

    return states[(1 << len(floors)) - 1][1]


def main():
    root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
    path = root / "data" / "stage_maps.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    stage = next(stage for stage in data["stages"] if stage["stageId"] == STAGE_ID)

    for tower_stage in data["stages"]:
        areas = tower_stage.get("areas") or []
        if not areas or tower_stage["stageId"] == STAGE_ID:
            continue
        inferred_floors = infer_area_floors(tower_stage)
        for area, floor in zip(areas, inferred_floors):
            area["floor"] = floor
            area["key"] = f"tower-{tower_stage['stageId']}-{floor}"
            area["label"] = f"第{floor}層"
            area["name"] = f"終末之塔第{floor}層"

    stage["areas"] = [
        {
            "key": f"tower-{STAGE_ID}-{floor}",
            "floor": floor,
            "label": f"第{floor}層",
            "name": f"終末之塔第{floor}層",
            "x": x,
            "y": y,
        }
        for floor, (x, y) in FLOOR_CENTERS.items()
    ]

    corrected_stages = 0
    corrected_markers = 0
    for tower_stage in data["stages"]:
        areas = tower_stage.get("areas") or []
        if not areas:
            continue
        corrected_stages += 1
        for marker in tower_stage.get("monsters", []) + tower_stage.get("npcs", []):
            area = nearest_area(marker["x"], marker["y"], areas)
            marker["floor"] = area["floor"]
            marker["areaKey"] = area["key"]
            marker["areaLabel"] = area["label"]
            marker["areaName"] = area["name"]
            corrected_markers += 1

    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Updated {path}: {corrected_stages} stages, {corrected_markers} markers")


if __name__ == "__main__":
    main()

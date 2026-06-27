# -*- coding: utf-8 -*-
"""Import RPGViewer-extracted SETTING files into the website raw data folder.

This helper does not read or modify the game client. It only consumes a
SETTING folder exported by RPGViewer, then prepares the existing website build
inputs.
"""

from __future__ import annotations

import argparse
import filecmp
import shutil
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_EXPORT_ROOT = Path(r"D:\神州拆包資料")

REQUIRED_RAW_ROOT_FILES = [
    "ITEM.INI",
    "MAGIC.INI",
    "STATUS.INI",
]
OPTIONAL_RAW_ROOT_FILES = [
    "COMPOUN.INI",
    "CHANGEBODYITEM.INI",
]
RAW_ROOT_FILES = [*REQUIRED_RAW_ROOT_FILES, *OPTIONAL_RAW_ROOT_FILES]
SETTING_FILES = [
    "COLLECTBOOKITEM.INI",
    *RAW_ROOT_FILES,
    "MONSTER_C.INI",
]


@dataclass
class PlannedCopy:
    src: Path
    dst: Path
    note: str = ""


def find_latest_setting(export_root: Path) -> Path:
    candidates = []
    if not export_root.exists():
        raise FileNotFoundError(f"找不到 RPGViewer 匯出根目錄：{export_root}")
    for child in export_root.iterdir():
        setting = child / "SETTING"
        if setting.is_dir():
            candidates.append(setting)
    if not candidates:
        raise FileNotFoundError(f"{export_root} 底下找不到任何 SETTING 資料夾")
    return max(candidates, key=lambda p: p.stat().st_mtime)


def require_source_file(setting_dir: Path, name: str) -> Path:
    path = setting_dir / name
    if not path.exists():
        raise FileNotFoundError(f"SETTING 缺少必要檔案：{path}")
    return path


def same_file_content(src: Path, dst: Path) -> bool:
    return dst.exists() and src.stat().st_size == dst.stat().st_size and filecmp.cmp(src, dst, shallow=False)


def plan_import(project: Path, setting_dir: Path) -> list[PlannedCopy]:
    raw = project / "raw"
    latest_setting = raw / "latest_setting"
    plans: list[PlannedCopy] = []

    for name in REQUIRED_RAW_ROOT_FILES:
        plans.append(PlannedCopy(require_source_file(setting_dir, name), raw / name))
    for name in OPTIONAL_RAW_ROOT_FILES:
        src = setting_dir / name
        if src.exists():
            plans.append(PlannedCopy(src, raw / name))
        elif not (raw / name).exists():
            raise FileNotFoundError(f"SETTING 缺少 {name}，而 raw 也沒有可沿用的舊檔：{raw / name}")
        else:
            print(f"keep existing optional file: {raw / name}")

    # build_data.py expects current monsters at raw/new/MONSTER_C.INI and prior
    # monsters at raw/old/MONSTER_C.INI, so we rotate the current one on apply.
    plans.append(PlannedCopy(require_source_file(setting_dir, "MONSTER_C.INI"), raw / "new" / "MONSTER_C.INI", "new monster"))

    # build_collectbook_sources.py can use this folder via --setting-dir.
    for name in SETTING_FILES:
        src = setting_dir / name
        if src.exists():
            plans.append(PlannedCopy(src, latest_setting / name, "collectbook setting"))

    return plans


def apply_import(project: Path, plans: list[PlannedCopy]) -> None:
    raw = project / "raw"
    current_monster = raw / "new" / "MONSTER_C.INI"
    old_monster = raw / "old" / "MONSTER_C.INI"
    incoming_monster = next((p.src for p in plans if p.dst == current_monster), None)

    if incoming_monster and current_monster.exists() and not same_file_content(incoming_monster, current_monster):
        old_monster.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(current_monster, old_monster)
        print(f"backup old monster: {current_monster} -> {old_monster}")

    for plan in plans:
        plan.dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(plan.src, plan.dst)
        print(f"copy: {plan.src} -> {plan.dst}")


def print_plan(setting_dir: Path, plans: list[PlannedCopy]) -> None:
    print(f"RPGViewer SETTING: {setting_dir}")
    for plan in plans:
        status = "same" if same_file_content(plan.src, plan.dst) else "copy"
        suffix = f" ({plan.note})" if plan.note else ""
        print(f"[{status}] {plan.src.name} -> {plan.dst}{suffix}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Import RPGViewer SETTING files into this website project.")
    parser.add_argument("--project", default=str(ROOT), help="Website project directory. Default: this repo.")
    parser.add_argument("--export-root", default=str(DEFAULT_EXPORT_ROOT), help="Folder containing dated RPGViewer exports.")
    parser.add_argument("--setting-dir", default="", help="Specific RPGViewer SETTING folder. If omitted, latest is used.")
    parser.add_argument("--apply", action="store_true", help="Actually copy files. Without this, only prints the plan.")
    args = parser.parse_args()

    project = Path(args.project).resolve()
    setting_dir = Path(args.setting_dir).resolve() if args.setting_dir else find_latest_setting(Path(args.export_root))
    plans = plan_import(project, setting_dir)
    print_plan(setting_dir, plans)
    if not args.apply:
        print("\nDry-run only. Add --apply to copy files.")
        return
    apply_import(project, plans)


if __name__ == "__main__":
    main()

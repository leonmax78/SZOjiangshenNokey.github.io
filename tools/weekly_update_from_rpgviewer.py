# -*- coding: utf-8 -*-
"""One-command website data refresh from RPGViewer SETTING exports.

RPGViewer is still responsible for unpacking update.pak. This script consumes
the exported SETTING folder, rebuilds website JSON bundles, rebuilds collectbook
data, and can optionally commit/push the result.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

import import_rpgviewer_setting


ROOT = Path(__file__).resolve().parents[1]


def run(cmd: list[str], cwd: Path = ROOT) -> None:
    print("\n> " + " ".join(str(x) for x in cmd))
    subprocess.run(cmd, cwd=str(cwd), check=True)


def common_export_roots() -> list[Path]:
    roots: list[Path] = []
    env = os.environ.get("SZO_RPGVIEWER_EXPORT_ROOT")
    if env:
        roots.append(Path(env))
    roots.extend(
        [
            Path(r"D:\神州拆包資料"),
            Path(r"E:\神州拆包資料"),
            Path.home() / "Desktop" / "神州拆包資料",
            Path.home() / "Documents" / "神州拆包資料",
        ]
    )
    out: list[Path] = []
    seen: set[str] = set()
    for root in roots:
        key = str(root).lower()
        if key not in seen:
            seen.add(key)
            out.append(root)
    return out


def find_latest_setting_auto() -> Path:
    errors: list[str] = []
    best: Path | None = None
    for root in common_export_roots():
        try:
            setting = import_rpgviewer_setting.find_latest_setting(root)
        except Exception as exc:
            errors.append(f"{root}: {exc}")
            continue
        if best is None or setting.stat().st_mtime > best.stat().st_mtime:
            best = setting
    for parent in (Path.home() / "Desktop", Path.home() / "Documents"):
        try:
            children = list(parent.iterdir())
        except Exception as exc:
            errors.append(f"{parent}: {exc}")
            continue
        for child in children:
            if not child.is_dir() or not child.name.isdigit() or len(child.name) != 4:
                continue
            setting = child / "SETTING"
            if setting.is_dir() and (best is None or setting.stat().st_mtime > best.stat().st_mtime):
                best = setting
    if best is None:
        raise FileNotFoundError("找不到 RPGViewer 匯出的 SETTING。\n" + "\n".join(errors))
    return best


def git_has_changes() -> bool:
    result = subprocess.run(["git", "status", "--porcelain"], cwd=str(ROOT), text=True, capture_output=True, check=True)
    return bool(result.stdout.strip())


def main() -> int:
    parser = argparse.ArgumentParser(description="Import RPGViewer SETTING, rebuild website data, and optionally push.")
    parser.add_argument("--setting-dir", default="", help="Specific RPGViewer SETTING folder.")
    parser.add_argument("--export-root", default="", help="Folder containing dated RPGViewer exports.")
    parser.add_argument("--skip-import", action="store_true", help="Do not copy SETTING into raw; only rebuild.")
    parser.add_argument("--skip-collectbook", action="store_true", help="Do not rebuild collectbook_sources.json.")
    parser.add_argument("--push", action="store_true", help="Commit and push generated website data.")
    parser.add_argument("--message", default="", help="Git commit message when --push is used.")
    args = parser.parse_args()

    setting_dir = Path(args.setting_dir).resolve() if args.setting_dir else None
    if setting_dir is None and args.export_root:
        setting_dir = import_rpgviewer_setting.find_latest_setting(Path(args.export_root))
    if setting_dir is None:
        setting_dir = find_latest_setting_auto()

    print(f"使用 SETTING：{setting_dir}")

    if not args.skip_import:
        plans = import_rpgviewer_setting.plan_import(ROOT, setting_dir)
        import_rpgviewer_setting.print_plan(setting_dir, plans)
        import_rpgviewer_setting.apply_import(ROOT, plans)

    run([sys.executable, str(ROOT / "tools" / "build_data.py")])
    run([sys.executable, str(ROOT / "tools" / "build_soul_data.py")])
    if (ROOT / "raw" / "SHOP.INI").exists():
        run([sys.executable, str(ROOT / "tools" / "build_shop_selected.py")])

    if not args.skip_collectbook:
        run(
            [
                sys.executable,
                str(ROOT / "tools" / "build_collectbook_sources.py"),
                "--setting-dir",
                str(ROOT / "raw" / "latest_setting"),
            ]
        )

    if args.push:
        run(["git", "status", "--short"])
        if git_has_changes():
            message = args.message or f"Update SZO data from RPGViewer {setting_dir.parent.name}"
            run([
                "git",
                "add",
                "raw/ITEM.INI",
                "raw/MAGIC.INI",
                "raw/STATUS.INI",
                "raw/CHANGEBODYITEM.INI",
                "raw/SHOP.INI",
                "raw/new/MONSTER_C.INI",
                "raw/MONSTER_C_MERGED.INI",
                "js/data/soul-data.js",
                "data",
                "reports",
                "tools/build_shop_selected.py",
                "tools/build_soul_data.py",
                "tools/import_rpgviewer_setting.py",
                "tools/weekly_update_from_rpgviewer.py",
                ".gitignore",
            ])
            run(["git", "commit", "-m", message])
            run(["git", "push"])
        else:
            print("沒有可推送的變更。")

    print("\n完成。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

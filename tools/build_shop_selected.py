from __future__ import annotations

import json
from pathlib import Path


SHOP_ORDER = [430, 432, 433, 435, 436, 438, 890, 891, 893, 895, 911]


def parse_item_ini(path: Path) -> dict[int, dict[str, str]]:
    rows: list[dict[str, str]] = []
    cur: dict[str, str] = {}

    def push() -> None:
        nonlocal cur
        if cur.get("ID"):
            rows.append(dict(cur))
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

    return {
        int(row["ID"]): row
        for row in rows
        if str(row.get("ID", "")).isdigit()
    }


def parse_shop_ini(path: Path) -> dict[int, dict[str, dict[int, float]]]:
    shops: dict[int, dict[str, dict[int, float]]] = {}
    current_id: int | None = None

    text = path.read_text(encoding="utf-8-sig", errors="replace")
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith(";") or line.startswith("//"):
            continue
        if line.startswith("["):
            current_id = None
            continue
        if "=" not in line:
            continue

        key, value = [part.strip() for part in line.split("=", 1)]
        key = key.lower()
        if key == "id":
            try:
                current_id = int(value, 0)
            except ValueError:
                current_id = None
                continue
            shops.setdefault(current_id, {"sell": {}, "buy": {}})
            continue

        if current_id is None or key not in {"sell", "buy"}:
            continue

        parts = [part.strip() for part in value.split(",")]
        if len(parts) < 2:
            continue
        try:
            item_id = int(parts[0], 0)
            percent = float(parts[1])
        except ValueError:
            continue
        shops.setdefault(current_id, {"sell": {}, "buy": {}})[key][item_id] = percent

    return shops


def calc_price(value: str | None, percent: float | None) -> int | None:
    if value in (None, "") or percent is None:
        return None
    try:
        return int(round(int(value) * percent / 100.0))
    except ValueError:
        return None


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    item_rows = parse_item_ini(root / "raw" / "ITEM.INI")
    shop_rows = parse_shop_ini(root / "raw" / "SHOP.INI")
    existing_path = root / "data" / "shop_selected_11_fixed.json"
    existing = json.loads(existing_path.read_text(encoding="utf-8"))
    shop_names = {int(shop["shopId"]): shop.get("shopName", "") for shop in existing.get("shops", [])}

    shops = []
    for shop_id in SHOP_ORDER:
        source = shop_rows.get(shop_id, {"sell": {}, "buy": {}})
        item_ids = list(source["sell"].keys())
        item_ids.extend(item_id for item_id in source["buy"].keys() if item_id not in source["sell"])

        items = []
        for item_id in item_ids:
            item = item_rows.get(item_id, {})
            items.append({
                "itemId": item_id,
                "name": item.get("Name") or str(item_id),
                "sellPrice": calc_price(item.get("Value"), source["sell"].get(item_id)),
                "buyPrice": calc_price(item.get("Value"), source["buy"].get(item_id)),
            })

        shops.append({
            "shopId": shop_id,
            "shopName": shop_names.get(shop_id, str(shop_id)),
            "items": items,
        })

    output = {
        "version": "shop_selected_11_fixed_v3_0625",
        "description": "指定11筆特殊商店販售資訊；由 SHOP.INI 的 Sell/Buy 百分比乘以 ITEM.INI Value 產生。",
        "shops": shops,
    }
    existing_path.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print(f"shops: {len(shops)}")
    print("items:", sum(len(shop["items"]) for shop in shops))


if __name__ == "__main__":
    main()

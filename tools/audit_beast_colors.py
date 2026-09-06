"""Export local sprite color corrections for review; never replaces website images."""
import argparse
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import rebuild_assets_from_szo_tool as rebuild
from beast_color_settings import calibrate_aligned, apply_settings


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--tool', type=Path, default=Path(r'C:\Users\leonm\Documents\Codex\2026-07-03\id-29622-icon-25575-gicon-35575\outputs\SZOAssetTool.pyw'))
    parser.add_argument('--settings-root', type=Path, default=Path(r'C:\Users\leonm\Desktop\0903'))
    parser.add_argument('--asset-root', type=Path, default=Path(r'C:\Users\leonm\Desktop\0702'))
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    output = root / 'outputs/beast-color-audit'
    output.mkdir(parents=True, exist_ok=True)
    beasts = json.loads((root / 'data/beasts.bundle.js').read_text('utf-8').removeprefix('window.SZO_BEASTS=').strip().removesuffix(';'))
    monsters = {row['ID']: row for row in json.loads((root / 'data/monsters.json').read_text('utf-8'))}
    tool = rebuild.load_tool(args.tool)
    objects = rebuild.parse_monster_objects(tool, args.settings_root)
    lookup = tool.resolve_shape_file
    tool.resolve_shape_file = lambda _root, directory, filename: lookup(args.settings_root, directory, filename) or lookup(args.asset_root, directory, filename)
    settings = {}
    report = []
    sheets = []
    font = ImageFont.truetype('C:/Windows/Fonts/msjh.ttc', 15)
    seen = set()
    for beast in beasts:
        mid = beast['monsterId']
        if mid in seen:
            continue
        if mid:
            seen.add(mid)
        monster = monsters.get(mid)
        reference_path = root / beast.get('portrait', 'missing')
        if not monster or not reference_path.is_file():
            report.append({'name': beast['name'], 'id': mid, 'status': 'missing-reference-or-id'})
            continue
        obj = rebuild.resolve_monster_object(tool, monster, objects)
        if not obj:
            report.append({'name': beast['name'], 'id': mid, 'status': 'missing-object'})
            continue
        file_map = tool.parse_spritefile_map(obj)
        source_path = tool.resolve_shape_file(args.asset_root, str(obj.get('Directory', '')), file_map.get('wait', ''))
        if not source_path:
            report.append({'name': beast['name'], 'id': mid, 'status': 'missing-sprite'})
            continue
        frames = tool.load_shape(source_path)
        frame_index = tool.preferred_monster_portrait_frame(obj, len(frames))
        source = tool.trim_visible(frames[frame_index]).convert('RGBA')
        reference = Image.open(reference_path).convert('RGBA')
        try:
            config = calibrate_aligned(frames, reference, tool.trim_visible)
        except ValueError as error:
            report.append({'name': beast['name'], 'id': mid, 'status': str(error)})
            continue
        corrected = apply_settings(source, config)
        assert corrected.size == source.size
        assert np.array_equal(np.asarray(source)[:, :, 3], np.asarray(corrected)[:, :, 3])
        config.update({'name': beast['name'], 'pic': monster['Pic'], 'baseBias': obj.get('BaseBias', ''), 'flags': obj.get('Flags', ''), 'sourceFile': str(source_path), 'frame': frame_index, 'reference': beast['portrait']})
        settings[mid] = config
        corrected.save(output / f'{mid}-corrected.png')
        source.save(output / f'{mid}-raw.png')
        report.append({'name': beast['name'], 'id': mid, 'status': 'calibrated-for-review', 'baseBias': obj.get('BaseBias', '')})
        tile = Image.new('RGB', (640, 205), '#202428')
        draw = ImageDraw.Draw(tile)
        draw.text((6, 3), f"{mid} {beast['name']}", font=font, fill='white')
        current = root / 'assets/test-media/monster-portraits' / f"m{monster['Pic']}.png"
        images = [Image.open(current).convert('RGBA') if current.exists() else source, source, corrected, reference]
        for i, (image, label) in enumerate(zip(images, ['目前染色', '原始素材', '校色結果', '巨門參考'])):
            image.thumbnail((146, 150))
            tile.paste(image, (i * 160 + (160-image.width)//2, 27 + (150-image.height)//2), image)
            draw.text((i*160+10, 182), label, font=font, fill='white')
        sheets.append(tile)
        if len(settings) % 20 == 0:
            print(f'{len(settings)} calibrated', flush=True)
    for page in range(0, len(sheets), 8):
        canvas = Image.new('RGB', (1280, 820), '#202428')
        for offset, tile in enumerate(sheets[page:page+8]):
            canvas.paste(tile, ((offset % 2)*640, (offset//2)*205))
        canvas.save(output / f'comparison-{page//8+1:02d}.png')
    (output / 'beast_color_settings.json').write_text(json.dumps({'version': 1, 'status': 'reference-calibrated-review', 'settings': settings}, ensure_ascii=False, separators=(',', ':'))+'\n', 'utf-8')
    (root / 'reports/beast-color-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', 'utf-8')
    print(json.dumps({'calibrated': len(settings), 'exceptions': [row for row in report if row['status'] != 'calibrated-for-review']}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()

"""Reference-calibrated channel curves for original beast sprites.

These are visual correction settings, not a reverse-engineered BaseBias decoder.
The sprite's dimensions, alpha, pose and pixel positions are never replaced.
"""
import numpy as np
from PIL import Image


def calibrate_aligned(frames, reference, trim):
    reference = trim(reference).convert('RGBA')
    target = np.asarray(reference.resize((96, 96)))
    target_mask = target[:, :, 3] >= 240
    candidates = []
    for index, frame in enumerate(frames):
        sample = np.asarray(trim(frame).convert('RGBA').resize((96, 96)))
        mask = sample[:, :, 3] >= 240
        union = np.count_nonzero(mask | target_mask)
        score = np.count_nonzero(mask & target_mask) / max(1, union)
        candidates.append((score, index, sample))
    score, index, sample = max(candidates, key=lambda item: item[0])
    if score < 0.88:
        raise ValueError('Reference pose does not align reliably')
    mask = (sample[:, :, 3] >= 250) & (target[:, :, 3] >= 250)
    # Exclude silhouette edges and interpolation halos from the fit.
    eroded = np.zeros_like(mask)
    eroded[1:-1, 1:-1] = mask[1:-1, 1:-1] & mask[:-2, 1:-1] & mask[2:, 1:-1] & mask[1:-1, :-2] & mask[1:-1, 2:]
    mask = eroded
    src = sample[:, :, :3][mask].astype(float)
    dst = target[:, :, :3][mask].astype(float)
    if len(src) < 40:
        raise ValueError('Insufficient aligned pixels')
    design = np.column_stack((src, np.ones(len(src))))
    keep = np.ones(len(src), dtype=bool)
    for _ in range(4):
        matrix = np.linalg.lstsq(design[keep], dst[keep], rcond=None)[0]
        residual = np.mean(np.abs(design @ matrix - dst), axis=1)
        keep = residual <= np.quantile(residual, 0.8)
    error = float(np.mean(residual[keep]))
    if error > 15:
        raise ValueError('Reference coloring is not explained by a linear correction')
    return {'method': 'rgb-affine-v1', 'matrix': matrix.tolist(), 'alignment': round(score, 4), 'referenceFrame': index, 'fitError': round(error, 3)}


def apply_settings(image, settings):
    if settings.get('method') == 'rgb-affine-v1':
        original = np.asarray(image.convert('RGBA'))
        result = original.copy()
        rgb = original[:, :, :3].astype(float)
        matrix = np.asarray(settings['matrix'])
        result[:, :, :3] = np.rint(rgb @ matrix[:3] + matrix[3]).clip(0, 255).astype(np.uint8)
        result[original[:, :, 3] == 0] = original[original[:, :, 3] == 0]
        return Image.fromarray(result)
    raise ValueError('Unsupported beast color settings')

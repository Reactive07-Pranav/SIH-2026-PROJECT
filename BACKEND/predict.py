"""Color-based field-strip classifier using Pillow only (no NumPy)."""

from __future__ import annotations

import io
import math

from PIL import Image

REFERENCES: list[tuple[str, str, tuple[float, float, float]]] = [
    ("amphetamine", "positive", (210, 55, 70)),
    ("cocaine", "positive", (70, 90, 200)),
    ("cannabis", "positive", (40, 150, 85)),
    ("opiate", "positive", (180, 90, 40)),
    ("negative", "negative", (235, 230, 215)),
    ("negative", "negative", (248, 248, 245)),
]


def _srgb_to_lab(r: float, g: float, b: float) -> tuple[float, float, float]:
    def lin(c: float) -> float:
        x = c / 255.0
        return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4

    rl, gl, bl = lin(r), lin(g), lin(b)
    x = (0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl) / 0.95047
    y = 0.2126729 * rl + 0.7151522 * gl + 0.0721750 * bl
    z = (0.0193339 * rl + 0.1191920 * gl + 0.9503041 * bl) / 1.08883
    eps, k = 216 / 24389, 24389 / 27

    def f(t: float) -> float:
        return t ** (1 / 3) if t > eps else (k * t + 16) / 116

    fx, fy, fz = f(x), f(y), f(z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def predict_image(data: bytes) -> dict:
    image = Image.open(io.BytesIO(data)).convert("RGB")
    w, h = image.size
    crop = image.crop((int(w * 0.25), int(h * 0.35), int(w * 0.75), int(h * 0.75)))
    if crop.size[0] == 0 or crop.size[1] == 0:
        crop = image
    crop = crop.resize((64, 64))
    pixels = list(crop.getdata())
    n = max(1, len(pixels))
    mean = [sum(p[i] for p in pixels) / n for i in range(3)]
    var = sum(sum((p[i] - mean[i]) ** 2 for i in range(3)) for p in pixels) / n
    std = math.sqrt(var)
    lab = _srgb_to_lab(mean[0], mean[1], mean[2])

    best_label, best_cls, best_d = "inconclusive", "inconclusive", 1e9
    for label, classification, ref_rgb in REFERENCES:
        ref_lab = _srgb_to_lab(*ref_rgb)
        dist = math.sqrt(sum((a - b) ** 2 for a, b in zip(lab, ref_lab)))
        if dist < best_d:
            best_d, best_label, best_cls = dist, label, classification

    if std < 8:
        best_cls, best_label = "inconclusive", "inconclusive"
        best_d = max(best_d, 40)

    confidence = float(max(0.05, min(0.98, 1.0 / (1.0 + best_d / 28.0))))
    if best_cls == "inconclusive":
        confidence = min(confidence, 0.45)

    return {
        "label": best_label,
        "classification": best_cls,
        "confidence": round(confidence, 4),
        "mean_rgb": [int(round(c)) for c in mean],
        "delta_e": round(best_d, 2),
        "notes": (
            "Center-crop LAB nearest-neighbor against immunoassay reference hues. "
            f"Image {w}×{h}px, crop contrast σ={std:.1f}."
        ),
    }

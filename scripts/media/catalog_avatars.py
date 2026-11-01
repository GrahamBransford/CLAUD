"""
Avatars for catalogue-only creators (heard through a connected service, not
yet in CIRCA's feeds): an abstract mark in each creator's palette, in the
same spirit as the sleeve motifs. Output: public/media/avatars/<id>.jpg
Usage: python3 scripts/media/catalog_avatars.py
"""
import json
import math
import os

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.abspath(__file__)) + "/../.."
CAT = json.load(open(f"{ROOT}/content/demo/catalog.json"))
OUT = f"{ROOT}/public/media/avatars"
W, SS = 480, 3


def finish(im, seed):
    im = im.resize((W, W), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    a += np.random.default_rng(seed).normal(0, 5, a.shape[:2])[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def mark(c, seed):
    bg, fg, ac = c["palette"]
    N = W * SS
    im = Image.new("RGB", (N, N), bg)
    d = ImageDraw.Draw(im)
    s = c["style"]
    if s in ("Soul & R&B",):  # a low sun over a horizon of lines
        d.ellipse([N * 0.22, N * 0.2, N * 0.78, N * 0.76], fill=fg)
        for k in range(7):
            y = N * (0.56 + k * 0.06)
            d.rectangle([0, y, N, y + N * 0.028], fill=bg)
    elif s == "Jazz":  # a stack of offset bars, like keys
        for k in range(6):
            x = N * (0.16 + k * 0.12)
            h = N * (0.3 + 0.35 * abs(math.sin(k * 1.7 + seed)))
            d.rectangle([x, N * 0.78 - h, x + N * 0.08, N * 0.78], fill=fg if k % 2 else ac)
    elif s == "Electronic":  # concentric rings, slightly off centre
        for k in range(9, 0, -1):
            r = N * 0.05 * k
            d.ellipse([N * 0.5 - r + k * 6, N * 0.5 - r, N * 0.5 + r + k * 6, N * 0.5 + r], outline=fg, width=SS * 3)
    elif s == "Folk":  # hills
        for k, col in enumerate((ac, fg, bg)):
            pts = [(x, N * (0.55 + k * 0.12) + math.sin(x / N * math.pi * (2 + k) + seed) * N * 0.06) for x in range(0, N + 1, N // 60)]
            d.polygon(pts + [(N, N), (0, N)], fill=col if k < 2 else fg)
    elif s == "Afro & highlife":  # a woven grid
        for i in range(6):
            for j in range(6):
                if (i + j) % 2 == 0:
                    d.rectangle([N * (0.1 + i * 0.135), N * (0.1 + j * 0.135), N * (0.22 + i * 0.135), N * (0.22 + j * 0.135)], fill=fg if i % 3 else ac)
    elif s == "Indie & dream pop":  # soft overlapping discs
        d.ellipse([N * 0.12, N * 0.2, N * 0.62, N * 0.7], fill=ac)
        d.ellipse([N * 0.38, N * 0.3, N * 0.88, N * 0.8], fill=fg)
    else:  # podcasts: a microphone grille on a plain field
        d.rounded_rectangle([N * 0.36, N * 0.18, N * 0.64, N * 0.62], radius=N * 0.14, fill=fg)
        for k in range(6):
            y = N * (0.25 + k * 0.055)
            d.line([(N * 0.4, y), (N * 0.6, y)], fill=bg, width=SS * 4)
        d.arc([N * 0.28, N * 0.36, N * 0.72, N * 0.74], 0, 180, fill=fg, width=SS * 8)
        d.line([(N * 0.5, N * 0.74), (N * 0.5, N * 0.84)], fill=fg, width=SS * 8)
        d.ellipse([N * 0.68, N * 0.16, N * 0.78, N * 0.26], fill=ac)
    return finish(im, seed)


if __name__ == "__main__":
    for i, c in enumerate(CAT["creators"]):
        if c.get("catalogOnly"):
            mark(c, i).save(f"{OUT}/{c['id']}.jpg", quality=86)
            print("avatar", c["id"])

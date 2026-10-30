"""
Illustrated portraits for the sample CIRCA listeners (and the demo user),
in the same faceless mid-century style as the podcast hosts.
Output: public/media/people/<id>.jpg
"""
import json
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.abspath(__file__)) + "/../.."
OUT = f"{ROOT}/public/media/people"
SOCIAL = json.load(open(f"{ROOT}/content/demo/people.json"))
W = 480
SS = 3

ME = {"id": "you", "palette": ["#C21F32", "#F2B42C", "#F6ECD8", "#221A15"], "hair": "wave", "skin": "#D9A27A"}


def S(v):
    return int(round(v * SS))


def ell(d, cx, cy, rx, ry, fill):
    d.ellipse([S(cx - rx), S(cy - ry), S(cx + rx), S(cy + ry)], fill=fill)


def shade(hex_, k):
    h = hex_.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return "#%02x%02x%02x" % tuple(max(0, min(255, int(c * k))) for c in (r, g, b))


def portrait(p):
    bg, sweater, accent, hair = p["palette"]
    skin = p["skin"]
    im = Image.new("RGB", (S(W), S(W)), bg)
    d = ImageDraw.Draw(im)
    # a sun disc behind the head: the mid-century poster backdrop
    ell(d, 240, 210, 150, 150, shade(bg, 1.12))
    cx = 240
    style = p["hair"]
    # hair that falls behind the shoulders
    if style in ("long", "fringe"):
        d.rounded_rectangle([S(cx - 92), S(150), S(cx + 92), S(390)], radius=S(70), fill=hair)
    if style == "curly":
        for dx, dy, r in [(-70, 150, 52), (70, 150, 52), (-40, 105, 56), (40, 105, 56), (0, 92, 58), (-82, 200, 44), (82, 200, 44)]:
            ell(d, cx + dx, dy, r, r, hair)
    # shoulders and neck
    d.rounded_rectangle([S(cx - 170), S(352), S(cx + 170), S(560)], radius=S(120), fill=sweater)
    d.rectangle([S(cx - 30), S(270), S(cx + 30), S(372)], fill=shade(skin, 0.86))
    d.polygon([(S(cx - 42), S(352)), (S(cx + 42), S(352)), (S(cx), S(400))], fill=shade(skin, 0.86))
    # head
    ell(d, cx, 205, 74, 90, skin)
    ell(d, cx - 72, 212, 12, 18, shade(skin, 0.92))
    ell(d, cx + 72, 212, 12, 18, shade(skin, 0.92))
    # hair on top
    if style == "bob":
        d.chord([S(cx - 84), S(104), S(cx + 84), S(290)], 180, 360, fill=hair)
        d.rectangle([S(cx - 84), S(196), S(cx - 56), S(286)], fill=hair)
        d.rectangle([S(cx + 56), S(196), S(cx + 84), S(286)], fill=hair)
    elif style == "short":
        d.chord([S(cx - 78), S(108), S(cx + 78), S(250)], 180, 360, fill=hair)
    elif style == "long":
        d.chord([S(cx - 84), S(104), S(cx + 84), S(276)], 180, 360, fill=hair)
    elif style == "fringe":
        d.chord([S(cx - 84), S(104), S(cx + 84), S(300)], 180, 360, fill=hair)
        d.rectangle([S(cx - 84), S(160), S(cx + 84), S(196)], fill=hair)
    elif style == "beard":
        d.chord([S(cx - 76), S(110), S(cx + 76), S(236)], 180, 360, fill=hair)
        d.chord([S(cx - 74), S(150), S(cx + 74), S(300)], 0, 180, fill=hair)
        ell(d, cx, 244, 30, 12, skin)
    elif style == "bun":
        ell(d, cx, 96, 36, 34, hair)
        d.chord([S(cx - 78), S(110), S(cx + 78), S(250)], 180, 360, fill=hair)
    elif style == "glasses":
        d.chord([S(cx - 78), S(108), S(cx + 78), S(240)], 180, 360, fill=hair)
        for gx in (-30, 30):
            d.ellipse([S(cx + gx - 22), S(196), S(cx + gx + 22), S(232)], outline="#1b1714", width=S(5))
        d.line([S(cx - 8), S(212), S(cx + 8), S(212)], fill="#1b1714", width=S(5))
    elif style == "curly":
        for dx, dy, r in [(-44, 128, 34), (0, 116, 38), (44, 128, 34)]:
            ell(d, cx + dx, dy, r, r, hair)
    elif style == "wave":
        d.chord([S(cx - 82), S(100), S(cx + 82), S(262)], 180, 360, fill=hair)
        ell(d, cx + 38, 128, 48, 30, hair)
    # collar accent
    d.chord([S(cx - 60), S(318), S(cx + 60), S(410)], 0, 180, fill=accent)
    d.chord([S(cx - 44), S(318), S(cx + 44), S(388)], 0, 180, fill=shade(skin, 0.86))
    im = im.resize((W, W), Image.LANCZOS).filter(ImageFilter.SMOOTH)
    a = np.asarray(im).astype(np.float32)
    a += np.random.default_rng(len(p["id"])).normal(0, 4, a.shape[:2])[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


os.makedirs(OUT, exist_ok=True)
for p in SOCIAL["people"] + [ME]:
    portrait(p).save(f"{OUT}/{p['id']}.jpg", quality=86)
print("people:", len(SOCIAL["people"]) + 1)

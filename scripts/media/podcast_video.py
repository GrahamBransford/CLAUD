"""
Renders an illustrated "video podcast" set for each episode, animated from the
speaker timings exported by podcasts.py, then cuts the highlight from it.
Output: public/media/speakers/<id>.full.mp4, <id>.highlight.mp4 (+ posters)
"""
import json
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw

import art

W, H, FPS = 960, 540, 15
SS = 2
OUT = f"{art.ROOT}/public/media/speakers"
os.makedirs(OUT, exist_ok=True)

LOOKS = {  # skin, hair colour, hair style, clothing, glasses
    "Priya Raman": ("#B07A58", "#2A1F1A", "long", "#3E4A3D", False),
    "Theo Marsh": ("#E3B897", "#6B4A2F", "short", "#963F36", False),
    "Desmond Hale": ("#6E4A33", "#1E1714", "crop", "#2F3550", True),
    "Rosa Quintero": ("#C68E67", "#2A1F1A", "bun", "#5F6E56", False),
    "Imani Brooks": ("#7A5038", "#1E1714", "afro", "#D6A84F", False),
    "Walter Fenn": ("#E8C3A5", "#E6E1D8", "bald", "#7A5A3E", True),
    "Nadia Kessler": ("#EBC6A8", "#8A4A2A", "bob", "#2F3550", False),
    "Sam Okafor": ("#5A3A28", "#1E1714", "crop", "#E9DCC2", False),
}


def S(v):
    return int(round(v * SS))


def layer(w, h):
    im = Image.new("RGBA", (S(w), S(h)), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def shrink(im):
    return im.resize((im.width // SS, im.height // SS), Image.LANCZOS)


def person_sprites(name):
    skin, hair, style, cloth, glasses = LOOKS[name]
    w, h = 300, 330
    body, d = layer(w, h)
    # shoulders + torso
    d.rounded_rectangle([S(40), S(200), S(260), S(420)], radius=S(70), fill=cloth)
    d.rectangle([S(128), S(170), S(172), S(215)], fill=skin)  # neck
    d.pieslice([S(118), S(186), S(182), S(236)], 0, 180, fill=skin)
    head, d = layer(w, h)
    cx, cy = 150, 130
    if style == "long":
        d.rounded_rectangle([S(cx - 66), S(cy - 60), S(cx - 26), S(cy + 104)], radius=S(20), fill=hair)
        d.rounded_rectangle([S(cx + 26), S(cy - 60), S(cx + 66), S(cy + 104)], radius=S(20), fill=hair)
    if style == "afro":
        d.ellipse([S(cx - 92), S(cy - 100), S(cx + 92), S(cy + 50)], fill=hair)
    if style == "bun":
        d.ellipse([S(cx - 30), S(cy - 108), S(cx + 30), S(cy - 52)], fill=hair)
    d.ellipse([S(cx - 52), S(cy - 64), S(cx + 52), S(cy + 64)], fill=skin)
    if style in ("short", "crop", "bob", "long", "bun"):
        top = {"short": 30, "crop": 18, "bob": 36, "long": 34, "bun": 30}[style]
        d.chord([S(cx - 56), S(cy - 70), S(cx + 56), S(cy + 40)], 180, 360, fill=hair)
        d.rectangle([S(cx - 56), S(cy - 20), S(cx + 56), S(cy - 20 + top * 0.4)], fill=hair)
        if style == "bob":
            d.rounded_rectangle([S(cx - 62), S(cy - 50), S(cx - 40), S(cy + 46)], radius=S(10), fill=hair)
            d.rounded_rectangle([S(cx + 40), S(cy - 50), S(cx + 62), S(cy + 46)], radius=S(10), fill=hair)
        if style == "short":
            d.ellipse([S(cx - 4), S(cy - 70), S(cx + 56), S(cy - 30)], fill=hair)
    if style == "bald":
        d.chord([S(cx - 56), S(cy - 30), S(cx - 30), S(cy + 20)], 90, 270, fill=hair)
        d.chord([S(cx + 30), S(cy - 30), S(cx + 56), S(cy + 20)], 270, 90, fill=hair)
    if glasses:
        for gx in (cx - 22, cx + 22):
            d.ellipse([S(gx - 15), S(cy - 6), S(gx + 15), S(cy + 18)], outline="#292722", width=S(3.5))
        d.line([S(cx - 7), S(cy + 4), S(cx + 7), S(cy + 4)], fill="#292722", width=S(3))
    # headphones
    d.arc([S(cx - 66), S(cy - 82), S(cx + 66), S(cy + 50)], 195, 345, fill="#292722", width=S(9))
    d.rounded_rectangle([S(cx - 74), S(cy - 22), S(cx - 50), S(cy + 30)], radius=S(9), fill="#292722")
    d.rounded_rectangle([S(cx + 50), S(cy - 22), S(cx + 74), S(cy + 30)], radius=S(9), fill="#292722")
    mic, d = layer(w, h)
    d.line([S(268), S(330), S(250), S(250), S(196), S(196)], fill="#3A3730", width=S(7), joint="curve")
    d.rounded_rectangle([S(168), S(170), S(214), S(232)], radius=S(22), fill="#1F1D19")
    for k in range(5):
        d.line([S(174), S(180 + k * 10), S(208), S(180 + k * 10)], fill="#3A3730", width=S(2))
    return [np.asarray(shrink(x)).astype(np.float32) / 255 for x in (body, head, mic)]


def paste(dst, src, x, y, alpha=1.0):
    h, w = src.shape[:2]
    x0, y0 = max(int(x), 0), max(int(y), 0)
    x1, y1 = min(int(x) + w, W), min(int(y) + h, H)
    if x0 >= x1 or y0 >= y1:
        return
    s = src[y0 - int(y):y1 - int(y), x0 - int(x):x1 - int(x)]
    a = s[..., 3:] * alpha
    dst[y0:y1, x0:x1] = dst[y0:y1, x0:x1] * (1 - a) + s[..., :3] * a


def set_background(show, ep, names):
    pal = show["palette"]
    wall = tuple(int(c * 0.82) for c in Image.new("RGB", (1, 1), pal[0]).getpixel((0, 0)))
    im = Image.new("RGB", (S(W), S(H)), wall)
    d = ImageDraw.Draw(im)
    for i in range(0, W, 24):  # acoustic slats
        d.rectangle([S(i), 0, S(i + 12), S(H * 0.7)], fill=tuple(int(c * 0.93) for c in wall))
    # framed show art
    sleeve = Image.open(f"{art.PUB}/podcast-art/{show['id']}.jpg").resize((S(132), S(132)))
    d.rectangle([S(W / 2 - 74), S(36), S(W / 2 + 74), S(184)], fill="#F4EBDD")
    im.paste(sleeve, (S(W / 2 - 66), S(44)))
    # plant + lamp
    d.rectangle([S(54), S(296), S(98), S(380)], fill="#7A5A3E")
    for k, (dx, dy) in enumerate(((-30, -60), (10, -90), (34, -50), (-8, -120), (22, -130))):
        d.ellipse([S(76 + dx - 16), S(296 + dy - 34), S(76 + dx + 16), S(296 + dy + 34)], fill="#5F6E56" if k % 2 else "#8A967B")
    d.polygon([S(W - 110), S(160), S(W - 60), S(160), S(W - 72), S(120), S(W - 98), S(120)], fill="#D6A84F")
    d.rectangle([S(W - 87), S(160), S(W - 83), S(380)], fill="#3A3730")
    wall_arr = np.asarray(shrink(im)).astype(np.float32) / 255
    im = Image.new("RGBA", (S(W), S(H)), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # desk (drawn in front of the people)
    d.rectangle([0, S(H * 0.72), S(W), S(H)], fill="#2B2722")
    d.rectangle([0, S(H * 0.72), S(W), S(H * 0.72 + 6)], fill="#4A4239")
    # nameplates
    for x, n in zip((W * 0.29, W * 0.71), names):
        f = art.sans(12, 600)
        art.tracked(d, (S(x), S(H * 0.72 + 22)), n.upper(), f, "#E6D5B8", 0.2, "m")
    # lower third
    d.text((S(28), S(H - 52)), show["name"], font=art.serif(26, 560, 72, 80), fill="#F4EBDD")
    d.text((S(28), S(H - 22)), f"Ep. {ep['number']} · {ep['title']}", font=art.sans(13, 500), fill="#C9BBA2")
    return wall_arr, np.asarray(shrink(im)).astype(np.float32) / 255


def onair(lit):
    im, d = layer(120, 40)
    d.rounded_rectangle([S(2), S(2), S(118), S(38)], radius=S(6), fill="#963F36" if lit else "#4A3A33",
                        outline="#F4EBDD" if lit else "#6E5A50", width=S(2))
    art.tracked(d, (S(60), S(11)), "ON AIR", art.sans(14, 700), "#F4EBDD" if lit else "#9C8A7E", 0.25, "m")
    return np.asarray(shrink(im)).astype(np.float32) / 255


def render(ep_id):
    meta = json.load(open(f"{art.WORK}/podcasts/{ep_id}.json"))
    ep = next(e for e in art.CAT["episodes"] if e["id"] == ep_id)
    show = art.CREATORS[ep["creatorId"]]
    keys = list(meta["speakers"])
    names = [meta["speakers"][k]["name"] for k in keys]
    bg, desk = set_background(show, ep, names)
    sprites = [person_sprites(n) for n in names]
    lamps = (onair(False), onair(True))
    speaking = [np.array(meta["speaking15"][k]) for k in keys]
    level = np.array(meta["level15"])
    level = level / (np.percentile(level, 98) + 1e-9)
    dur = meta["duration"]
    full = f"{OUT}/{ep_id}.full.mp4"
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", f"{art.WORK}/podcasts/{ep_id}.full.wav", "-map", "0:v", "-map", "1:a",
           "-c:v", "libx264", "-preset", "medium", "-crf", "27", "-pix_fmt", "yuv420p", "-g", "30", "-tune", "animation",
           "-c:a", "aac", "-b:a", "96k", "-ac", "1", "-shortest", "-movflags", "+faststart", full]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    n = int(dur * FPS)
    sm = [0.0, 0.0]
    hl0 = meta["highlight"]["start"]
    for f in range(n):
        t = f / FPS
        frame = bg.copy()
        any_on = False
        for i, (body, head, mic) in enumerate(sprites):
            on = speaking[i][f] if f < len(speaking[i]) else 0
            any_on = any_on or on > 0
            lv = level[f] if f < len(level) else 0
            sm[i] += ((on * min(lv, 1.2)) - sm[i]) * 0.5
            x = W * (0.29 if i == 0 else 0.71) - 150
            y = H * 0.72 - 300
            breathe = math.sin(t * 1.6 + i) * 1.2
            bob = -sm[i] * 5 + math.sin(t * 9 + i) * sm[i] * 2.2
            tilt = math.sin(t * 0.7 + i * 2) * 2
            paste(frame, body, x, y + breathe)
            paste(frame, head, x + tilt, y + bob + breathe * 0.6)
        paste(frame, desk, 0, 0)
        for i, (_, _, mic) in enumerate(sprites):
            paste(frame, mic, W * (0.29 if i == 0 else 0.71) - 150, H * 0.72 - 300)
        paste(frame, lamps[1 if any_on else 0], W - 150, 26)
        b = (np.clip(frame, 0, 1) * 255).astype(np.uint8)
        p.stdin.write(b.tobytes())
        if f == int((hl0 + 20) * FPS):
            Image.fromarray(b).save(f"{OUT}/{ep_id}.jpg", quality=85)
        if f == int(30 * FPS):
            Image.fromarray(b).save(f"{OUT}/{ep_id}.full.jpg", quality=85)
    p.stdin.close()
    p.wait()
    h = meta["highlight"]
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(h["start"]), "-i", full, "-t", str(h["duration"]),
                    "-i", f"{art.WORK}/podcasts/{ep_id}.highlight.wav", "-map", "0:v", "-map", "1:a",
                    "-c:v", "libx264", "-preset", "medium", "-crf", "27", "-pix_fmt", "yuv420p", "-g", "30",
                    "-c:a", "aac", "-b:a", "96k", "-ac", "1", "-shortest", "-movflags", "+faststart",
                    f"{OUT}/{ep_id}.highlight.mp4"], check=True)
    print(f"{ep_id}: studio video done ({n} frames)")


if __name__ == "__main__":
    for e in sys.argv[1:]:
        render(e)

"""
Renders the generative music videos for the six demo songs, synced to the
beat grid and loudness exported by songs.py, and muxes them with the audio.
Output: public/media/singers/<id>.mp4 (+ poster frame .jpg)
"""
import json
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw

import art

ROOT = art.ROOT
WORK = art.WORK
OUT = f"{ROOT}/public/media/singers"
W, H, FPS = 960, 540, 24
os.makedirs(OUT, exist_ok=True)


def hexc(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32) / 255


YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)


def blend(img, mask, col, alpha=1.0):
    m = mask[..., None] * alpha
    return img * (1 - m) + col * m


def disk(img, cx, cy, r, col, alpha=1.0, soft=1.2):
    x0, x1 = max(int(cx - r - 3), 0), min(int(cx + r + 3), W)
    y0, y1 = max(int(cy - r - 3), 0), min(int(cy + r + 3), H)
    if x0 >= x1 or y0 >= y1 or r <= 0:
        return
    d = np.sqrt((XX[y0:y1, x0:x1] - cx) ** 2 + (YY[y0:y1, x0:x1] - cy) ** 2)
    m = np.clip((r - d) / soft + 0.5, 0, 1)
    img[y0:y1, x0:x1] = blend(img[y0:y1, x0:x1], m, col, alpha)


def crescent(img, cx, cy, r, bite_dx, col, alpha=1.0):
    x0, x1 = max(int(cx - r - 3), 0), min(int(cx + r + 3), W)
    y0, y1 = max(int(cy - r - 3), 0), min(int(cy + r + 3), H)
    if x0 >= x1 or y0 >= y1 or r <= 0:
        return
    X, Y = XX[y0:y1, x0:x1], YY[y0:y1, x0:x1]
    m = np.clip((r - np.sqrt((X - cx) ** 2 + (Y - cy) ** 2)) / 1.2 + 0.5, 0, 1)
    b = np.clip((r * 0.98 - np.sqrt((X - cx - bite_dx) ** 2 + (Y - cy) ** 2)) / 1.2 + 0.5, 0, 1)
    img[y0:y1, x0:x1] = blend(img[y0:y1, x0:x1], m * (1 - b), col, alpha)


def ring(img, cx, cy, r, w, col, alpha=1.0):
    x0, x1 = max(int(cx - r - w - 3), 0), min(int(cx + r + w + 3), W)
    y0, y1 = max(int(cy - r - w - 3), 0), min(int(cy + r + w + 3), H)
    if x0 >= x1 or y0 >= y1:
        return
    d = np.abs(np.sqrt((XX[y0:y1, x0:x1] - cx) ** 2 + (YY[y0:y1, x0:x1] - cy) ** 2) - r)
    m = np.clip((w / 2 - d) / 1.2 + 0.5, 0, 1)
    img[y0:y1, x0:x1] = blend(img[y0:y1, x0:x1], m, col, alpha)


def rect(img, x0, y0, x1, y1, col, alpha=1.0):
    xa, xb = max(int(round(x0)), 0), min(int(round(x1)), W)
    ya, yb = max(int(round(y0)), 0), min(int(round(y1)), H)
    if xa < xb and ya < yb:
        img[ya:yb, xa:xb] = img[ya:yb, xa:xb] * (1 - alpha) + col * alpha


class Clock:
    def __init__(self, ev):
        self.ev = ev
        self.rms = np.array(ev["rms24"])
        self.kicks = np.array(sorted(ev["accents"]["kick"])) if ev["accents"]["kick"] else np.array([1e9])
        self.snares = np.array(sorted(ev["accents"]["snare"])) if ev["accents"]["snare"] else np.array([1e9])
        self.spb = 60 / ev["bpm"]

    def level(self, t, smooth=6):
        i = int(t * 24)
        a, b = max(0, i - smooth), min(len(self.rms), i + 1)
        return float(self.rms[a:b].mean()) if b > a else 0.0

    def pulse(self, t, which="kick", decay=6.0):
        arr = self.kicks if which == "kick" else self.snares
        i = np.searchsorted(arr, t) - 1
        if i < 0:
            return 0.0
        return math.exp(-(t - arr[i]) * decay)

    def beat(self, t):
        return t / self.spb

    def energy(self, t):
        for s in self.ev["sections"]:
            if s["start"] <= t < s["end"]:
                return s["energy"]
        return 0.3


# ------------------------------------------------------------------ styles

def style_paper_moons(img, t, c, st):
    bg = hexc("#7E2F2A") * (0.88 + 0.12 * c.level(t))
    img[:] = bg
    k = c.pulse(t, "kick", 5)
    rng = np.random.default_rng(11)
    for i in range(46):
        x, y = rng.uniform(0, W), rng.uniform(0, H)
        tw = 0.5 + 0.5 * math.sin(t * rng.uniform(0.6, 2.2) + i)
        disk(img, x, y, 1.6 + tw * 1.4, hexc("#E9C77B"), 0.35 + 0.5 * tw)
    sun_y = H * (0.95 - 0.55 * min(t / 110, 1))
    disk(img, W * 0.5, sun_y, 70 + 6 * k, hexc("#E9C77B"))
    for i in range(9):
        depth = 0.5 + (i % 3) * 0.35
        speed = 9 * depth
        x = (W * ((i * 0.37 + 0.07) % 1) + math.sin(t * 0.3 + i) * 30) % (W + 120) - 60
        y = (H + 120) - ((t * speed + i * 140) % (H + 240))
        r = 34 * depth * (1 + 0.05 * k)
        phase = math.sin(t * 0.25 + i * 1.3)
        bite = (0.35 + 0.75 * abs(phase)) * r * (1 if phase >= 0 else -1)
        crescent(img, x + 6, y + 8, r, bite, hexc("#5E201C"), 0.6)  # paper shadow
        crescent(img, x, y, r, bite, hexc("#F1E6D3"))


def style_coastline(img, t, c, st):
    sky = hexc("#EFE4CF")
    img[:] = sky
    sun_y = H * (0.30 + 0.25 * min(t / 110, 1))
    disk(img, W * 0.6, sun_y, 92, hexc("#B8553F"))
    horizon = H * 0.56
    img[int(horizon):] = sky
    lvl = c.level(t, 10)
    for k in range(10):
        y0 = horizon + 8 + k * 21
        amp = 4 + 10 * lvl * (1 + k * 0.1)
        ph = t * (0.8 + k * 0.12) + k
        ys = y0 + np.sin(np.arange(W) / W * math.pi * (3 + k * 0.5) + ph) * amp
        col = hexc("#5F6E56") if k % 2 == 0 else hexc("#8A967B")
        m = np.clip(4.5 - np.abs(YY[int(y0 - 30):int(y0 + 30)] - ys[None, :]), 0, 1)
        sl = img[int(y0 - 30):int(y0 + 30)]
        img[int(y0 - 30):int(y0 + 30)] = blend(sl, m[: sl.shape[0]], col)
    # sun glints on the snare
    g = c.pulse(t, "snare", 4)
    for j in range(5):
        rect(img, W * 0.6 - 60 + j * 22 - 9, horizon + 14 + j * 9, W * 0.6 - 60 + j * 22 + 9 + 14 * g, horizon + 17 + j * 9, hexc("#B8553F"), 0.5 + 0.5 * g)


def style_cathedral(img, t, c, st):
    img[:] = hexc("#2F3550")
    e = c.energy(t)
    k = c.pulse(t, "kick", 7)
    speed = 0.12 + 0.18 * e
    st["z"] = st.get("z", 0) + speed / FPS * 2
    for n in range(16):
        z = ((n * 0.0825 - st["z"]) % 1.32) + 0.02
        sc = 0.09 / z
        if sc > 4:
            continue
        w = W * 0.7 * sc
        h = H * 1.0 * sc
        cx, base = W / 2, H * 0.5 + h * 0.45
        top = base - h
        col = hexc("#D6A84F") if n % 2 == 0 else hexc("#C8695A")
        lw = max(1.0, 3.2 * sc * (1 + 0.6 * k))
        alpha = min(1, (1.32 - z) * 1.4) * min(1, sc * 3)
        r = w / 2
        rect(img, cx - r - lw / 2, top + r, cx - r + lw / 2, base, col, alpha)
        rect(img, cx + r - lw / 2, top + r, cx + r + lw / 2, base, col, alpha)
        # arch top (upper half ring)
        x0, x1 = max(int(cx - r - lw - 2), 0), min(int(cx + r + lw + 2), W)
        y0, y1 = max(int(top - lw - 2), 0), min(int(top + r + 1), H)
        if x0 < x1 and y0 < y1:
            d = np.abs(np.sqrt((XX[y0:y1, x0:x1] - cx) ** 2 + (YY[y0:y1, x0:x1] - (top + r)) ** 2) - r)
            m = np.clip((lw / 2 - d) / 1.2 + 0.5, 0, 1)
            img[y0:y1, x0:x1] = blend(img[y0:y1, x0:x1], m, col, alpha)
    lvl = c.level(t, 4)
    disk(img, W / 2, H * 0.5, 34 + 40 * lvl, hexc("#D6A84F"), 0.12)
    disk(img, W / 2, H * 0.5, 14 + 6 * lvl, hexc("#F4EBDD"))


def style_harmattan(img, t, c, st):
    img[:] = hexc("#C9832F")
    cx, cy = W / 2, H * 0.47
    ang = np.arctan2(YY - cy, XX - cx) + t * 0.18
    rays = (np.floor(ang / (math.pi / 12)) % 2 == 0).astype(np.float32)
    img[:] = blend(img, rays, hexc("#B9742A"))
    b = c.beat(t)
    for j in range(4):
        age = (b % 1 + j) / 4
        ring(img, cx, cy, 120 + age * 520, 10 * (1 - age), hexc("#EED9A6"), (1 - age) * 0.7)
    k = c.pulse(t, "kick", 6)
    for r, col in ((150, "#3B2A22"), (126, "#EED9A6"), (102, "#C9832F"), (80, "#3B2A22"), (46, "#EED9A6")):
        disk(img, cx, cy, r * (1 + 0.035 * k), hexc(col))
    rect(img, 0, H * 0.8, W, H, hexc("#3B2A22"))
    lvl = c.level(t, 2)
    for i in range(24):
        h = 8 + 50 * lvl * (0.5 + 0.5 * math.sin(t * 6 + i * 1.7)) * (0.6 + 0.4 * ((i * 7) % 5) / 4)
        x = W * 0.06 + i * W * 0.0375
        rect(img, x, H * 0.8 - h, x + W * 0.022, H * 0.8, hexc("#3B2A22"))


def style_slow_burn(img, t, c, st):
    img[:] = hexc("#292722")
    disk(img, W * 0.72, H * 0.26, 64 + 4 * c.level(t), hexc("#963F36"))
    rng = np.random.default_rng(9)
    pan = t * 14
    b = c.beat(t)
    for i in range(40):
        w = rng.uniform(18, 42)
        base_h = rng.uniform(0.25, 0.62) * H
        x = (i * 46 - pan) % (40 * 46) - 46
        if x > W:
            continue
        beat_idx = int(b)
        bump = 1.0 + 0.18 * (((beat_idx + i * 3) % 7) == 0) * math.exp(-(b % 1) * 3)
        h = base_h * bump
        col = hexc("#E6D5B8") if rng.uniform() < 0.72 else hexc("#963F36")
        rect(img, x, H * 0.76 - h * 0.85, x + w, H * 0.76, col)
    rect(img, 0, H * 0.76, W, H * 0.772, hexc("#E6D5B8"))
    s = c.pulse(t, "snare", 5)
    rect(img, W * 0.75, H * 0.86, W * 0.75 + W * 0.18 * s, H * 0.866, hexc("#963F36"))


def style_glass(img, t, c, st):
    top, bot = hexc("#6F8790"), hexc("#EFE4D0")
    grad = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    drift = 0.04 * math.sin(t * 0.07)
    img[:] = top + (bot - top) * np.clip(grad + drift, 0, 1)
    bands = (np.floor((YY / H + t * 0.004) * 14) % 2).astype(np.float32)
    img[:] = blend(img, bands, hexc("#FFFFFF"), 0.035)
    lvl = c.level(t, 12)
    for j in range(9):
        y0 = H * (0.22 + j * 0.055)
        off = math.sin(t * 0.35 + j * 0.8) * (18 + 30 * lvl) * (j - 4) / 4
        col = hexc("#D6A84F") if j < 5 else hexc("#EFE4D0")
        rect(img, W / 2 - 170 + off, y0, W / 2 + 170 + off, y0 + H * 0.05, col, 0.92)
    rect(img, 0, H * 0.76, W, H * 0.764, hexc("#6F8790"))
    img[int(H * 0.764):] = img[int(H * 0.764):] * 0.94 + hexc("#6F8790") * 0.06


STYLES = {"paper-moons": style_paper_moons, "coastline-static": style_coastline, "cathedral-lights": style_cathedral,
          "harmattan-sun": style_harmattan, "slow-burn-avenue": style_slow_burn, "glass-horizon": style_glass}
PLATE = {"coastline-static": ("#EFE4CF", 0.7), "glass-horizon": ("#EFE4D0", 0.7)}
INK = {"paper-moons": "#F1E6D3", "coastline-static": "#292722", "cathedral-lights": "#F4EBDD",
       "harmattan-sun": "#EED9A6", "slow-burn-avenue": "#E6D5B8", "glass-horizon": "#292722"}


def text_layers(song):
    """Pre-rendered RGBA overlays: opening title card and lower-left credit."""
    artist = art.CREATORS[song["creatorId"]]["name"]
    col = INK[song["id"]]
    title = Image.new("RGBA", (W * art.SS, H * art.SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(title)
    art.tracked(d, (W * art.SS / 2, H * art.SS * 0.4), artist.upper(), art.sans(15, 600), col, 0.35, "m")
    d.text((W * art.SS / 2, H * art.SS * 0.58), song["title"], font=art.serif(64, 450, 96, 100, True), fill=col, anchor="ms")
    credit = Image.new("RGBA", (W * art.SS, H * art.SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(credit)
    x, y = 40 * art.SS, H * art.SS - 92 * art.SS
    d.text((x, y), artist, font=art.sans(15, 600), fill=col)
    d.text((x, y + 22 * art.SS), f"“{song['title']}”", font=art.serif(20, 450, 36, 100, True), fill=col)
    d.text((x, y + 50 * art.SS), f"{song['release']} · {song['year']}", font=art.sans(12, 500), fill=col)
    out = []
    for im in (title, credit):
        im = im.resize((W, H), Image.LANCZOS)
        a = np.asarray(im).astype(np.float32) / 255
        out.append(a)
    return out


def render(sid):
    song = next(s for s in art.CAT["songs"] if s["id"] == sid)
    ev = json.load(open(f"{WORK}/audio/{sid}.events.json"))
    c = Clock(ev)
    dur = ev["duration"]
    title, credit = text_layers(song)
    wav = f"{WORK}/audio/{sid}.wav"
    out = f"{OUT}/{sid}.mp4"
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "slow", "-crf", "24",
           "-pix_fmt", "yuv420p", "-g", "48", "-tune", "animation", "-c:a", "aac", "-b:a", "160k", "-shortest",
           "-movflags", "+faststart", out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    img = np.zeros((H, W, 3), dtype=np.float32)
    st = {}
    n = int(dur * FPS)
    poster_at = int(min(ev["previewEnd"] * 0.4, 30) * FPS)
    for f in range(n):
        t = f / FPS
        STYLES[sid](img, t, c, st)
        frame = img.copy()
        ta = np.clip(1 - (t - 3.2) / 1.0, 0, 1) * np.clip(t / 0.8, 0, 1)
        if ta > 0:
            # darken behind the title card slightly so it reads on any motif
            pc, pa = PLATE.get(sid, ("#000000", 0.25))
            frame = frame * (1 - pa * ta) + hexc(pc) * pa * ta
            frame = frame * (1 - title[..., 3:] * ta) + title[..., :3] * title[..., 3:] * ta
        ca = np.clip((t - 5.5) / 0.8, 0, 1) * np.clip((12.5 - t) / 0.8, 0, 1)
        if ca > 0:
            frame = frame * (1 - credit[..., 3:] * ca) + credit[..., :3] * credit[..., 3:] * ca
        fade = min(1.0, (dur - t) / 2.0, t / 0.6)
        frame *= max(fade, 0)
        b = (np.clip(frame, 0, 1) * 255).astype(np.uint8)
        p.stdin.write(b.tobytes())
        if f == poster_at:
            Image.fromarray(b).save(f"{OUT}/{sid}.jpg", quality=86)
    p.stdin.close()
    p.wait()
    print(f"{sid}: video done ({n} frames)")


if __name__ == "__main__":
    for sid in sys.argv[1:] or list(STYLES):
        render(sid)

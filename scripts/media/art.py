"""
Generates the prototype's original artwork: record-sleeve covers, podcast
art, creator avatars and the two Handhelds photo posts.
Output: public/media/{covers,podcast-art,avatars,handhelds}
"""
import json
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.abspath(__file__)) + "/../.."
WORK = os.environ.get("WORK", "/tmp/claude-0/work")
FONTS = f"{WORK}/fonts"
PUB = f"{ROOT}/public/media"
CAT = json.load(open(f"{ROOT}/src/data/catalog.json"))
CREATORS = {c["id"]: c for c in CAT["creators"]}

CREAM, INK, RED, OCHRE, SAGE = "#F4EBDD", "#292722", "#963F36", "#D6A84F", "#8A967B"
SS = 2  # supersampling


def serif(size, wght=600, opsz=72, soft=50, italic=False):
    f = ImageFont.truetype(f"{FONTS}/Fraunces{'-Italic' if italic else ''}.ttf", int(size * SS))
    f.set_variation_by_axes([opsz, wght, soft, 0])
    return f


def sans(size, wght=600, width=100):
    f = ImageFont.truetype(f"{FONTS}/InstrumentSans.ttf", int(size * SS))
    f.set_variation_by_axes([width, wght])
    return f


def hand(size, wght=500):
    f = ImageFont.truetype(f"{FONTS}/Caveat.ttf", int(size * SS))
    f.set_variation_by_axes([wght])
    return f


def canvas(w, h, bg):
    im = Image.new("RGB", (w * SS, h * SS), bg)
    return im, ImageDraw.Draw(im)


def finish(im, w, h, grain=6, seed=1):
    im = im.resize((w, h), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    rng = np.random.default_rng(seed)
    a += rng.normal(0, grain, a.shape[:2])[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def tracked(d, xy, text, font, fill, tracking=0.18, anchor="l"):
    """Letter-spaced small caps style label."""
    x, y = xy
    widths = [d.textlength(ch, font=font) for ch in text]
    total = sum(widths) + tracking * font.size * (len(text) - 1)
    if anchor == "r":
        x -= total
    elif anchor == "m":
        x -= total / 2
    for ch, wch in zip(text, widths):
        d.text((x, y), ch, font=font, fill=fill)
        x += wch + tracking * font.size


def S(v):
    return int(round(v * SS))


def circle(d, cx, cy, r, fill=None, outline=None, width=1):
    d.ellipse([S(cx - r), S(cy - r), S(cx + r), S(cy + r)], fill=fill, outline=outline, width=int(width * SS))


# ------------------------------------------------------------- sleeve motifs

def motif_paper_moons(d, W, H):
    d.rectangle([0, 0, S(W), S(H)], fill="#7E2F2A")
    cx, cy, R = W * 0.5, H * 0.92, W * 0.55
    for i in range(7):
        a = math.pi * (0.12 + i * 0.76 / 6)
        x, y = cx - R * math.cos(a), cy - R * math.sin(a) * 1.05
        r = W * 0.068
        circle(d, x, y, r, fill="#F1E6D3")
        phase = (i - 3) / 3
        circle(d, x + phase * r * 1.15, y, r * (0.98 if abs(phase) > 0.01 else 0), fill="#7E2F2A")
    circle(d, W * 0.5, H * 0.66, W * 0.1, fill="#E9C77B")
    rng = np.random.default_rng(3)
    for _ in range(40):
        x, y = rng.uniform(0.05, 0.95) * W, rng.uniform(0.05, 0.75) * H
        circle(d, x, y, rng.uniform(1.2, 3.2), fill="#E9C77B")


def motif_coastline(d, W, H):
    d.rectangle([0, 0, S(W), S(H)], fill="#EFE4CF")
    circle(d, W * 0.62, H * 0.5, W * 0.2, fill="#B8553F")
    d.rectangle([0, S(H * 0.5), S(W), S(H)], fill="#EFE4CF")
    for k in range(9):
        y0 = H * (0.52 + k * 0.055)
        pts = [(S(x), S(y0 + math.sin(x / W * math.pi * (3 + k * 0.4) + k) * H * 0.012)) for x in range(0, W + 10, 8)]
        col = "#5F6E56" if k % 2 == 0 else "#8A967B"
        d.line(pts, fill=col, width=int(S(H * 0.014)))


def motif_cathedral(d, W, H):
    d.rectangle([0, 0, S(W), S(H)], fill="#2F3550")
    for k in range(8):
        sc = 1 - k * 0.11
        w, h = W * 0.62 * sc, H * 0.82 * sc
        x0, y1 = W / 2 - w / 2, H * 0.92 - k * H * 0.025
        y0 = y1 - h
        col = "#D6A84F" if k % 2 == 0 else "#C8695A"
        lw = int(S(4 if k % 2 == 0 else 2.5))
        d.line([(S(x0), S(y1)), (S(x0), S(y0 + w / 2))], fill=col, width=lw)
        d.line([(S(x0 + w), S(y1)), (S(x0 + w), S(y0 + w / 2))], fill=col, width=lw)
        d.arc([S(x0), S(y0), S(x0 + w), S(y0 + w)], 180, 360, fill=col, width=lw)
    circle(d, W / 2, H * 0.48, W * 0.035, fill="#F4EBDD")


def motif_harmattan(d, W, H):
    d.rectangle([0, 0, S(W), S(H)], fill="#C9832F")
    cx, cy = W / 2, H * 0.47
    for i in range(24):
        a0 = i * 15
        if i % 2 == 0:
            d.pieslice([S(cx - W), S(cy - W), S(cx + W), S(cy + W)], a0, a0 + 15, fill="#B9742A")
    for r, col in ((0.34, "#3B2A22"), (0.29, "#EED9A6"), (0.24, "#C9832F"), (0.19, "#3B2A22"), (0.12, "#EED9A6")):
        circle(d, cx, cy, W * r, fill=col)
    d.rectangle([0, S(H * 0.8), S(W), S(H)], fill="#3B2A22")


def motif_slow_burn(d, W, H):
    d.rectangle([0, 0, S(W), S(H)], fill="#292722")
    circle(d, W * 0.7, H * 0.28, W * 0.11, fill="#963F36")
    rng = np.random.default_rng(9)
    x = W * 0.08
    while x < W * 0.92:
        w = rng.uniform(0.03, 0.07) * W
        h = rng.uniform(0.25, 0.62) * H
        col = "#E6D5B8" if rng.uniform() < 0.72 else "#963F36"
        d.rectangle([S(x), S(H * 0.86 - h), S(x + w), S(H * 0.86)], fill=col)
        x += w + rng.uniform(0.012, 0.03) * W
    d.rectangle([S(W * 0.08), S(H * 0.86), S(W * 0.92), S(H * 0.875)], fill="#E6D5B8")


def motif_glass(d, W, H):
    top, bot = np.array([111, 135, 144]), np.array([239, 228, 208])
    for i in range(12):
        c = tuple(int(v) for v in top + (bot - top) * (i / 11))
        d.rectangle([0, S(H * i / 12), S(W), S(H * (i + 1) / 12)], fill=c)
    for j in range(7):
        off = (j - 3) * W * 0.018
        y0 = H * (0.3 + j * 0.06)
        d.rectangle([S(W * 0.5 - W * 0.19 + off), S(y0), S(W * 0.5 + W * 0.19 + off), S(y0 + H * 0.055)], fill="#D6A84F" if j < 4 else "#EFE4D0")
    d.rectangle([0, S(H * 0.74), S(W), S(H * 0.745)], fill="#6F8790")


MOTIFS = {
    "paper-moons": motif_paper_moons, "coastline-static": motif_coastline, "cathedral-lights": motif_cathedral,
    "harmattan-sun": motif_harmattan, "slow-burn-avenue": motif_slow_burn, "glass-horizon": motif_glass,
}
TYPE_COLOR = {"paper-moons": "#F1E6D3", "coastline-static": "#292722", "cathedral-lights": "#F4EBDD",
              "harmattan-sun": "#EED9A6", "slow-burn-avenue": "#E6D5B8", "glass-horizon": "#292722"}


def cover(song, W=1200):
    im, d = canvas(W, W, CREAM)
    MOTIFS[song["id"]](d, W, W)
    col = TYPE_COLOR[song["id"]]
    artist = CREATORS[song["creatorId"]]["name"]
    tracked(d, (S(W * 0.06), S(W * 0.055)), artist.upper(), sans(26, 600), col, 0.22)
    tracked(d, (S(W * 0.94), S(W * 0.055)), str(song["year"]), sans(26, 500), col, 0.22, "r")
    d.text((S(W * 0.06), S(W * 0.95)), song["title"], font=serif(92, 500, 96, 100, True), fill=col, anchor="ls")
    return finish(im, W, W, 5, 1)


def avatar_from_motif(sid, W=480):
    im, d = canvas(W * 2, W * 2, CREAM)
    MOTIFS[sid](d, W * 2, W * 2)
    im = im.crop((S(W * 0.5), S(W * 0.35), S(W * 1.5), S(W * 1.35)))
    return finish(im, W, W, 4, 2)


# ------------------------------------------------------------- podcast art

def podcast_art(cid, W=1200, with_type=True):
    c = CREATORS[cid]
    bg, fg, ac = c["palette"][0], c["palette"][1], c["palette"][2]
    im, d = canvas(W, W, bg)
    if cid == "long-way-round":
        pts = []
        for i in range(400):
            t = i / 399
            x = W * (0.08 + 0.84 * t)
            y = W * (0.62 + 0.18 * math.sin(t * math.pi * 3.2) * (1 - t * 0.3) - 0.25 * t)
            pts.append((S(x), S(y)))
        d.line(pts, fill=fg, width=int(S(10)), joint="curve")
        circle(d, W * 0.08, W * 0.62, 18, fill=fg)
        circle(d, W * 0.92, pts[-1][1] / SS, 26, fill=RED)
    elif cid == "liner-notes":
        x0, y0, s_ = W * 0.52, W * 0.14, W * 0.4
        d.rectangle([S(x0), S(y0), S(x0 + s_), S(y0 + s_)], fill=fg)
        f = sans(13, 500)
        for i in range(14):
            yy = y0 + 34 + i * 26
            d.rectangle([S(x0 + 30), S(yy), S(x0 + 30 + (s_ - 60) * (0.45 + 0.5 * ((i * 37) % 11) / 11)), S(yy + 7)], fill=ac if i % 4 else bg)
        circle(d, x0 - 10, y0 + s_ / 2, s_ * 0.42, fill=ac)
        circle(d, x0 - 10, y0 + s_ / 2, s_ * 0.13, fill=bg)
        circle(d, x0 - 10, y0 + s_ / 2, s_ * 0.02, fill=fg)
        del f
    elif cid == "small-machines":
        cx, cy, R = W * 0.5, W * 0.4, W * 0.27
        d.rectangle([S(cx - R * 1.3), S(cy - R * 0.62), S(cx + R * 1.3), S(cy + R * 0.62)], fill=fg)
        d.rectangle([S(cx - R * 1.15), S(cy - R * 0.32), S(cx + R * 1.15), S(cy + R * 0.0)], fill=bg)
        for i in range(23):
            x = cx - R * 1.05 + i * R * 2.1 / 22
            d.line([(S(x), S(cy - R * 0.28)), (S(x), S(cy - R * (0.18 if i % 2 else 0.1)))], fill=fg, width=int(S(3)))
        d.line([(S(cx + R * 0.25), S(cy - R * 0.32)), (S(cx + R * 0.25), S(cy))], fill=ac, width=int(S(6)))
        circle(d, cx - R * 0.75, cy + R * 0.33, R * 0.17, fill=ac)
        circle(d, cx + R * 0.75, cy + R * 0.33, R * 0.17, fill=ac)
        for k in range(5):
            d.line([(S(cx - R * 0.4), S(cy + R * (0.18 + k * 0.08))), (S(cx + R * 0.4), S(cy + R * (0.18 + k * 0.08)))], fill=bg, width=int(S(3)))
    elif cid == "kitchen-table":
        d.rectangle([0, S(W * 0.62), S(W), S(W * 0.66)], fill=fg)
        for j, (x, n) in enumerate(((0.26, 3), (0.42, 6), (0.58, 9), (0.74, 13))):
            for k in range(n):
                y = W * 0.6 - k * W * 0.032
                d.ellipse([S(W * x - 52), S(y - 14), S(W * x + 52), S(y + 14)], fill=fg if k % 2 == 0 else ac, outline=bg, width=int(S(3)))
    if with_type:
        words = c["name"].split()
        lines = [" ".join(words[:2]), " ".join(words[2:])] if len(words) > 2 else [c["name"]]
        if c["name"] == "Kitchen Table Economics":
            lines = ["Kitchen Table", "Economics"]
        y = W * 0.79
        for i, ln in enumerate(lines):
            d.text((S(W * 0.07), S(y + i * W * 0.095)), ln, font=serif(104, 640, 120, 100), fill=fg, anchor="ls")
        tracked(d, (S(W * 0.07), S(W * 0.06)), "A PODCAST", sans(24, 600), fg, 0.3)
        tracked(d, (S(W * 0.93), S(W * 0.06)), " & ".join(c["hosts"]).upper(), sans(20, 500), fg, 0.18, "r")
    return finish(im, W, W, 5, 3)


# ------------------------------------------------------------- handheld photos

def photo_finish(im, seed, warm=(1.06, 1.0, 0.9), vignette=0.5, angle=-2.2, noise=9):
    im = im.rotate(angle, resample=Image.BICUBIC, expand=False, fillcolor=(40, 34, 28))
    a = np.asarray(im).astype(np.float32) / 255
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h * 0.45) / (h / 2)) ** 2)
    a *= (1 - vignette * np.clip(r - 0.35, 0, 1) ** 1.6)[..., None]
    a *= np.array(warm)
    rng = np.random.default_rng(seed)
    a += rng.normal(0, noise / 255, a.shape)
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    return im.filter(ImageFilter.GaussianBlur(0.6))


def lyric_sheet(W=1080, H=1350):
    im, d = canvas(W, H, "#5A3F2E")  # wooden desk
    rng = np.random.default_rng(4)
    for i in range(60):
        y = rng.uniform(0, H)
        d.line([(0, S(y)), (S(W), S(y + rng.uniform(-30, 30)))], fill=(84 + int(rng.uniform(-8, 8)), 60, 44), width=int(S(rng.uniform(2, 8))))
    paper = Image.new("RGB", (S(W * 0.82), S(H * 0.86)), "#F6EFE2")
    pd = ImageDraw.Draw(paper)
    for k in range(26):
        y = S(150 + k * 40)
        pd.line([(S(20), y), (paper.width - S(20), y)], fill="#C9D6DD", width=int(S(1.5)))
    pd.line([(S(110), 0), (S(110), paper.height)], fill="#E3A9A0", width=int(S(2)))
    lyrics = ["Paper Moons", "", "you cut the light out of the evening", "and hung it where the ceiling ends",
              "two paper moons above the bed", "we said we'd fix them in the morning", "",
              "and all the rooms we never finished", "still hum with what we meant to say",
              "(slower here?)  paper moons don't fade away", "", "chorus x2 -> hold the Rhodes", "Dm9  G13  Cmaj9  A7"]
    y = 92
    for i, ln in enumerate(lyrics):
        f = hand(54 if i == 0 else 40, 600 if i == 0 else 450)
        col = "#963F36" if "(" in ln or "->" in ln else "#2B2A33"
        pd.text((S(130), S(y)), ln, font=f, fill=col, anchor="ls")
        y += 40 if i else 58
    pd.line([(S(130), S(y - 470)), (S(560), S(y - 470))], fill="#2B2A33", width=int(S(2)))
    # coffee ring
    cr = (S(560), S(1010), S(150))
    for k in range(10):
        pd.ellipse([cr[0] - cr[2] - k, cr[1] - cr[2] - k, cr[0] + cr[2] + k, cr[1] + cr[2] + k], outline=(176, 128, 82), width=int(S(1)))
    paper = paper.rotate(4, expand=True, fillcolor=(0, 0, 0, 0), resample=Image.BICUBIC)
    mask = paper.convert("L").point(lambda v: 255 if v > 8 else 0)
    shadow = Image.new("RGB", paper.size, (30, 20, 15))
    im.paste(shadow, (S(W * 0.08) + 20, S(H * 0.06) + 26), mask.filter(ImageFilter.GaussianBlur(30)))
    im.paste(paper, (S(W * 0.07), S(H * 0.05)), mask)
    im = im.resize((W, H), Image.LANCZOS)
    return photo_finish(im, 5, (1.08, 1.0, 0.86), 0.55, -1.5)


def whiteboard(W=1080, H=1350):
    im, d = canvas(W, H, "#B9B4AA")
    d.rectangle([S(40), S(110), S(W - 40), S(H - 160)], fill="#F2F1EC", outline="#9A968E", width=int(S(10)))
    rng = np.random.default_rng(8)

    def wob(p, q, col="#1F3A5F", w=5):
        pts = []
        for t in np.linspace(0, 1, 30):
            pts.append((S(p[0] + (q[0] - p[0]) * t + rng.normal(0, 1.2)), S(p[1] + (q[1] - p[1]) * t + rng.normal(0, 1.2))))
        d.line(pts, fill=col, width=int(S(w)), joint="curve")

    def box(x, y, w, h, label, col="#1F3A5F"):
        wob((x, y), (x + w, y), col); wob((x + w, y), (x + w, y + h), col)
        wob((x + w, y + h), (x, y + h), col); wob((x, y + h), (x, y), col)
        d.text((S(x + w / 2), S(y + h / 2 + 14)), label, font=hand(48, 600), fill=col, anchor="ms")

    def arrow(p, q, col="#1F3A5F"):
        wob(p, q, col, 4)
        ang = math.atan2(q[1] - p[1], q[0] - p[0])
        for s_ in (-0.5, 0.5):
            wob(q, (q[0] - 28 * math.cos(ang + s_), q[1] - 28 * math.sin(ang + s_)), col, 4)
    d.text((S(W / 2), S(205)), "WHERE DOES IT GO??", font=hand(70, 700), fill="#963F36", anchor="ms")
    box(380, 250, 320, 100, "you press play")
    arrow((540, 352), (540, 430))
    box(330, 432, 420, 100, "the big pot", "#963F36")
    d.text((S(770), S(500)), "(subs + ads)", font=hand(38), fill="#5A6E4F", anchor="ls")
    arrow((420, 535), (230, 640)); arrow((660, 535), (850, 640))
    box(90, 642, 300, 100, "recording")
    box(690, 642, 320, 100, "composition")
    arrow((240, 745), (240, 840)); arrow((850, 745), (850, 840))
    box(110, 842, 260, 90, "label / dist.")
    box(700, 842, 300, 90, "publisher")
    arrow((240, 935), (420, 1050)); arrow((850, 935), (660, 1050))
    d.text((S(540), S(1095)), "the artist (with a cup)", font=hand(54, 700), fill="#963F36", anchor="ms")
    d.text((S(860), S(1150)), "attention = currency", font=hand(40, 600), fill="#5A6E4F", anchor="ms")
    im = im.resize((W, H), Image.LANCZOS)
    return photo_finish(im, 9, (1.0, 1.0, 0.97), 0.45, 1.8, 7)


def main():
    for sub in ("covers", "podcast-art", "avatars", "handhelds"):
        os.makedirs(f"{PUB}/{sub}", exist_ok=True)
    for song in CAT["songs"]:
        cover(song).save(f"{PUB}/covers/{song['id']}.jpg", quality=86)
        avatar_from_motif(song["id"]).save(f"{PUB}/avatars/{song['creatorId']}.jpg", quality=86)
    for c in CAT["creators"]:
        if c["kind"] == "podcast":
            podcast_art(c["id"]).save(f"{PUB}/podcast-art/{c['id']}.jpg", quality=86)
            podcast_art(c["id"], 480, False).save(f"{PUB}/avatars/{c['id']}.jpg", quality=86)
    lyric_sheet().save(f"{PUB}/handhelds/hh-juniper-lyrics.jpg", quality=84)
    whiteboard().save(f"{PUB}/handhelds/hh-kitchen-whiteboard.jpg", quality=84)
    print("art done")


if __name__ == "__main__":
    main()

"""
Raw, phone-shot style clips for Handhelds: vertical, shaky, grainy, with
room tone. Scenes are procedural; audio is synthesized or voiced locally.
Output: public/media/handhelds/<id>.mp4 + <id>.jpg poster
"""
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image
from scipy import signal

import art
import synth as s
from synth import SR

W, H, FPS = 540, 960, 24
PW, PH = 620, 1100  # rendered larger, then cropped by the "hand"
OUT = f"{art.PUB}/handhelds"
TMP = f"{art.WORK}/handhelds"
os.makedirs(OUT, exist_ok=True)
os.makedirs(TMP, exist_ok=True)
YY, XX = np.mgrid[0:PH, 0:PW].astype(np.float32)


def hexc(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32) / 255


def soft_disk(img, cx, cy, r, col, alpha, soft=3.0, add=True, ring=0.0):
    x0, x1 = max(int(cx - r - soft * 3), 0), min(int(cx + r + soft * 3), PW)
    y0, y1 = max(int(cy - r - soft * 3), 0), min(int(cy + r + soft * 3), PH)
    if x0 >= x1 or y0 >= y1:
        return
    d = np.sqrt((XX[y0:y1, x0:x1] - cx) ** 2 + (YY[y0:y1, x0:x1] - cy) ** 2)
    m = np.clip((r - d) / soft + 0.5, 0, 1)
    if ring:
        m = m * (1 + ring * np.clip(d / max(r, 1), 0, 1) ** 4)
    if add:
        img[y0:y1, x0:x1] += m[..., None] * col * alpha
    else:
        img[y0:y1, x0:x1] = img[y0:y1, x0:x1] * (1 - m[..., None] * alpha) + col * m[..., None] * alpha


def rect(img, x0, y0, x1, y1, col, alpha=1.0):
    xa, xb = max(int(x0), 0), min(int(x1), PW)
    ya, yb = max(int(y0), 0), min(int(y1), PH)
    if xa < xb and ya < yb:
        img[ya:yb, xa:xb] = img[ya:yb, xa:xb] * (1 - alpha) + col * alpha


def smooth_noise(n, rate, seed):
    rng = np.random.default_rng(seed)
    k = max(4, int(n * rate / FPS) + 4)
    pts = rng.normal(0, 1, k)
    xs = np.linspace(0, k - 1, n)
    return np.interp(xs, np.arange(k), pts)


class Hand:
    """Handheld camera: wobble, drift and auto-exposure breathing."""

    def __init__(self, n, seed, amp=9.0, walk=False):
        self.dx = smooth_noise(n, 1.2, seed) * amp + smooth_noise(n, 5, seed + 1) * amp * 0.25
        self.dy = smooth_noise(n, 1.0, seed + 2) * amp + smooth_noise(n, 5, seed + 3) * amp * 0.25
        self.rot = smooth_noise(n, 0.8, seed + 4) * 0.9
        if walk:
            t = np.arange(n) / FPS
            self.dy += np.abs(np.sin(t * math.pi * 1.9)) * 14
            self.dx += np.sin(t * math.pi * 0.95) * 8
        self.exp = 1 + smooth_noise(n, 0.5, seed + 5) * 0.05
        self.rng = np.random.default_rng(seed + 9)

    def finish(self, f, img, warm=(1.0, 1.0, 1.0), grain=0.05):
        im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
        im = im.rotate(self.rot[f], resample=Image.BILINEAR, center=(PW / 2, PH / 2))
        cx, cy = (PW - W) / 2 + self.dx[f], (PH - H) / 2 + self.dy[f]
        im = im.crop((int(cx), int(cy), int(cx) + W, int(cy) + H))
        # phone-ish softness
        im = im.resize((W // 2, H // 2), Image.BILINEAR).resize((W, H), Image.BICUBIC)
        a = np.asarray(im).astype(np.float32) / 255 * self.exp[f] * np.array(warm, dtype=np.float32)
        a += self.rng.normal(0, grain, (H // 2, W // 2)).repeat(2, 0).repeat(2, 1)[..., None]
        return (np.clip(a, 0, 1) * 255).astype(np.uint8)


def phone_mic(x, room=0.004, seed=1):
    x = s.filt(x, "highpass", 140)
    x = s.filt(x, "lowpass", 8500)
    x = np.tanh(x * 2.2) / 2.2
    rng = np.random.default_rng(seed)
    x = x + s.filt(rng.standard_normal(len(x)), "lowpass", 2500) * room
    return x / (np.abs(x).max() + 1e-9) * 0.85


def tts(text, speaker, length=1.12):
    from piper import PiperVoice
    from piper.config import SynthesisConfig
    v = PiperVoice.load(f"{art.WORK}/voices/en-us-libritts-high.onnx", config_path=f"{art.WORK}/voices/en-us-libritts-high.onnx.json")
    cfg = SynthesisConfig(speaker_id=speaker, length_scale=length, noise_scale=0.62, noise_w_scale=0.8)
    out = []
    for sentence in text.split("|"):
        chunks = list(v.synthesize(sentence.strip(), syn_config=cfg))
        a = np.concatenate([c.audio_float_array for c in chunks])
        a = signal.resample_poly(a, SR, chunks[0].sample_rate)
        out.append(a / (np.abs(a).max() + 1e-9) * 0.8)
        out.append(np.zeros(int(SR * 0.55)))
    return np.concatenate(out)


def song_excerpt(sid, t0, dur):
    from scipy.io import wavfile
    sr, x = wavfile.read(f"{art.WORK}/audio/{sid}.wav")
    x = x.astype(np.float32).mean(1) / 32768
    return x[int(t0 * sr):int((t0 + dur) * sr)]


def mux(cid, frames_fn, n, audio):
    wav = f"{TMP}/{cid}.wav"
    s.write_wav(wav, audio)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "medium", "-crf", "29",
           "-pix_fmt", "yuv420p", "-g", "48", "-c:a", "aac", "-b:a", "112k", "-ac", "1", "-shortest",
           "-movflags", "+faststart", f"{OUT}/{cid}.mp4"]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f in range(n):
        b = frames_fn(f)
        p.stdin.write(b.tobytes())
        if f == min(n - 1, int(2.5 * FPS)):
            Image.fromarray(b).save(f"{OUT}/{cid}.jpg", quality=84)
    p.stdin.close()
    p.wait()
    print(f"{cid}: done ({n / FPS:.1f}s)")


# ---------------------------------------------------------------- clips

def juniper_2am():
    dur = 26.0
    bpm, spb = 72, 60 / 72
    chords = [(38, [53, 57, 60, 64]), (43, [53, 59, 64, 69]), (36, [52, 55, 59, 62]), (45, [55, 61, 64, 70])]
    bus = s.Bus(dur)
    notes = []
    for bar in range(int(dur / (4 * spb)) + 1):
        b, v = chords[bar % 4]
        for beat, L in ((0, 2.6), (2.5, 1.4)):
            t = (bar * 4 + beat) * spb + 0.6
            for i, m in enumerate(v):
                bus.add(s.rhodes(m, L * spb, 0.62), t + i * 0.02, -0.1)
            bus.add(s.rhodes(b + 12, L * spb, 0.5), t)
            notes.append(t)
    hum = [(0, 2, 69), (2, 1, 72), (3, 3, 74), (6, 2, 72), (8, 3, 69), (11, 1, 67), (12, 4, 65)]
    for rep in (1, 3):
        for beat, L, m in hum:
            bus.add(s.voice(m, L * spb, 0.5, "mm", 0.2), (rep * 4 * 4 * spb / 4) * 1 + beat * spb + 3.0)
    x = bus.trim(dur).mean(0)
    x = s.reverb(x, 0.6, 0.18).mean(0)
    audio = phone_mic(x, 0.006, 3)
    n = int(dur * FPS)
    hand = Hand(n, 11, 7)
    rng = np.random.default_rng(5)
    lights = [(rng.uniform(0, PW), rng.uniform(80, 520), rng.uniform(16, 40), rng.uniform(0, 6)) for _ in range(22)]

    def frame(f):
        t = f / FPS
        img = np.zeros((PH, PW, 3), np.float32)
        img[:] = hexc("#2A1914") * (0.75 + 0.25 * (1 - YY[..., None] / PH))
        for x, y, r, ph in lights:  # string lights out of focus
            tw = 0.75 + 0.25 * math.sin(t * 1.3 + ph)
            soft_disk(img, x, y, r, hexc("#E9A85A"), 0.22 * tw, 4, True, 0.6)
        soft_disk(img, PW * 0.78, 300, 160, hexc("#F2B866"), 0.18, 70)  # lamp glow
        # rhodes lid + keys at the bottom of frame, slightly out of focus
        rect(img, 0, PH * 0.68, PW, PH, hexc("#1B1210"))
        rect(img, 0, PH * 0.68, PW, PH * 0.69, hexc("#5A3A2A"), 0.8)
        kw = PW / 16
        for k in range(17):
            pressed = any(0 <= t - nt < 0.5 and (k * 7 + int(nt * 3)) % 5 == 0 for nt in notes)
            rect(img, k * kw + 1, PH * 0.74 + (4 if pressed else 0), k * kw + kw - 2, PH, hexc("#E8DCC4") * (0.62 if pressed else 0.8))
        for k in range(17):
            if k % 7 in (2, 6):
                continue
            rect(img, k * kw + kw * 0.66, PH * 0.74, k * kw + kw * 1.34, PH * 0.86, hexc("#151010"))
        return hand.finish(f, img, (1.08, 0.97, 0.84), 0.06)
    mux("hh-juniper-2am", frame, n, audio)


def cass_bridge():
    dur = 28.0
    spb = 60 / 84
    prog = [(41, [57, 60, 64, 67]), (38, [57, 60, 65, 66]), (43, [58, 62, 65, 69]), (36, [58, 64, 67, 70])]
    bus = s.Bus(dur)
    events = []
    mel = [79, 77, 76, 74, 72, 74, 76, 77]
    for bar in range(int(dur / (4 * spb))):
        r, v = prog[bar % 4]
        t = bar * 4 * spb + 0.5
        for i, m in enumerate(v):
            bus.add(s.piano(m, 3 * spb, 0.5), t + i * 0.03)
            events.append((t + i * 0.03, m))
        bus.add(s.piano(r, 3 * spb, 0.55), t)
        events.append((t, r))
        for e in range(4):
            m = mel[(bar * 2 + e) % 8] - (0 if bar % 2 else 2)
            tt = t + (e + 0.5) * spb
            bus.add(s.piano(m, 0.9 * spb, 0.6), tt)
            events.append((tt, m))
    x = s.reverb(bus.trim(dur).mean(0), 1.1, 0.2).mean(0)
    audio = phone_mic(x, 0.004, 4)
    n = int(dur * FPS)
    hand = Hand(n, 21, 5)

    def frame(f):
        t = f / FPS
        img = np.zeros((PH, PW, 3), np.float32)
        img[:] = hexc("#1E1A16")
        soft_disk(img, PW * 0.3, PH * 0.1, 260, hexc("#F4E3C2"), 0.15, 120)
        # keyboard seen from the lid, in perspective
        top, bot = PH * 0.2, PH * 1.02
        for k in range(-2, 22):
            midi_white = [0, 2, 4, 5, 7, 9, 11]
            m = 48 + (k // 7) * 12 + midi_white[k % 7]
            pressed = any(0 <= t - et < 0.45 and em == m for et, em in events)
            for y in range(int(top), int(bot), 6):
                p = (y - top) / (bot - top)
                wk = 24 + 34 * p
                x0 = PW / 2 + (k - 10) * wk
                c = hexc("#EDE3D0") * (0.55 + 0.4 * p) * (0.8 if pressed else 1)
                rect(img, x0 + 1, y, x0 + wk - 1, y + 6, c)
        for k in range(-2, 22):
            if k % 7 in (2, 6):
                continue
            for y in range(int(top), int(top + (bot - top) * 0.6), 6):
                p = (y - top) / (bot - top)
                wk = 24 + 34 * p
                x0 = PW / 2 + (k - 10) * wk + wk * 0.66
                rect(img, x0, y, x0 + wk * 0.68, y + 6, hexc("#141210"))
        rect(img, 0, top - 30, PW, top, hexc("#2B2420"))
        return hand.finish(f, img, (1.05, 1.0, 0.9), 0.045)
    mux("hh-cass-bridge", frame, n, audio)


def imani_radio():
    speech = tts("Okay. So this just came in this morning.|Nineteen sixty two. It sat in a barn for about forty years.|"
                 "Walter replaced the capacitors, and we're turning it on for the first time.|Listen.", 180)
    speech2 = tts("Oh. There it is.|That's a whole song, coming through a radio that hasn't spoken since before I was born.", 180)
    t_speech, t_tune, t_lock = 0.6, len(speech) / SR + 0.9, len(speech) / SR + 6.4
    dur = t_lock + 9.0 + len(speech2) / SR
    n_s = int(dur * SR)
    rng = np.random.default_rng(3)
    stat = s.filt(rng.standard_normal(n_s), "bandpass", [300, 3500]) * 0.25
    tt = np.arange(n_s) / SR
    whistle = np.sin(2 * np.pi * np.cumsum(800 + 600 * np.sin(tt * 1.7)) / SR) * 0.05
    sweep_env = np.clip((tt - t_tune) / 0.5, 0, 1) * np.clip((t_lock + 0.8 - tt) / 1.2, 0, 1)
    music = song_excerpt("paper-moons", 30, dur)
    music = np.pad(music, (0, max(0, n_s - len(music))))[:n_s]
    music = np.tanh(s.filt(music, "bandpass", [280, 3200]) * 2.5) * 0.5
    music_env = np.clip((tt - t_lock) / 1.5, 0, 1)
    hum = np.sin(2 * np.pi * 60 * tt) * 0.02 * np.clip((tt - t_tune + 0.5) / 0.5, 0, 1)
    room = (stat + whistle) * sweep_env + music * music_env * 0.9 + hum
    voice = np.zeros(n_s)
    i0 = int(t_speech * SR)
    voice[i0:i0 + len(speech)] += speech[: n_s - i0]
    i1 = int((t_lock + 5.0) * SR)
    voice[i1:i1 + len(speech2)] += speech2[: max(0, n_s - i1)]
    audio = phone_mic(s.reverb(room * 0.5, 0.5, 0.25).mean(0) + voice * 0.9, 0.004, 5)
    n = int(dur * FPS)
    hand = Hand(n, 31, 6)

    def frame(f):
        t = f / FPS
        img = np.zeros((PH, PW, 3), np.float32)
        img[:] = hexc("#3A2C22")
        rect(img, 0, PH * 0.78, PW, PH, hexc("#5A4231"))  # workbench
        # wooden cabinet
        x0, y0, x1, y1 = PW * 0.08, PH * 0.3, PW * 0.92, PH * 0.74
        rect(img, x0, y0, x1, y1, hexc("#7A4E2E"))
        for k in range(14):
            rect(img, x0, y0 + k * 34, x1, y0 + k * 34 + 2, hexc("#6A4227"), 0.6)
        # dial window
        glow = np.clip((t - t_tune + 1.0) / 1.5, 0, 1)
        rect(img, x0 + 40, y0 + 50, x1 - 40, y0 + 150, hexc("#2A1E16"))
        rect(img, x0 + 46, y0 + 56, x1 - 46, y0 + 144, hexc("#E9C77B") * (0.35 + 0.65 * glow))
        for k in range(21):
            xx = x0 + 60 + k * (x1 - x0 - 120) / 20
            rect(img, xx, y0 + 70, xx + 2, y0 + (100 if k % 5 == 0 else 86), hexc("#3A2C22"))
        if t < t_tune:
            pos = 0.18
        elif t < t_lock:
            u = (t - t_tune) / (t_lock - t_tune)
            pos = 0.18 + 0.5 * u + 0.06 * math.sin(u * 9)
        else:
            pos = 0.64
        nx = x0 + 60 + pos * (x1 - x0 - 120)
        rect(img, nx - 2, y0 + 58, nx + 2, y0 + 142, hexc("#963F36"))
        soft_disk(img, PW / 2, y0 + 100, 240, hexc("#F2B866"), 0.12 * glow, 90)
        # speaker cloth + knobs
        rect(img, x0 + 40, y0 + 180, x1 - 40, y1 - 40, hexc("#C9B48C"))
        for k in range(0, int(y1 - 40 - (y0 + 180)), 8):
            rect(img, x0 + 40, y0 + 180 + k, x1 - 40, y0 + 182 + k, hexc("#B09A72"), 0.7)
        soft_disk(img, x0 + 90, y1 + 40, 34, hexc("#2A1E16"), 1.0, 1.5, False)
        soft_disk(img, x1 - 90, y1 + 40, 34, hexc("#2A1E16"), 1.0, 1.5, False)
        return hand.finish(f, img, (1.06, 1.0, 0.9), 0.05)
    mux("hh-imani-radio", frame, n, audio)


def teodora_soundcheck():
    dur = 24.0
    x = song_excerpt("cathedral-lights", 37, dur)
    x = s.filt(x, "lowpass", 4500)
    x = s.reverb(x, 3.6, 0.55, 0.06).mean(0)
    rng = np.random.default_rng(8)
    room = s.filt(rng.standard_normal(len(x)), "lowpass", 900) * 0.03
    audio = phone_mic(x + room, 0.01, 8)
    n = int(dur * FPS)
    hand = Hand(n, 41, 10)
    beams = [(-0.3, "#D6A84F"), (0.0, "#C8695A"), (0.28, "#8C9BD0"), (-0.12, "#E9C77B")]

    def frame(f):
        t = f / FPS
        img = np.zeros((PH, PW, 3), np.float32)
        img[:] = hexc("#121220")
        for i, (a0, col) in enumerate(beams):
            ang = a0 + 0.22 * math.sin(t * 0.5 + i * 1.7)
            ox = PW * (0.2 + 0.2 * i)
            d = (XX - ox) * math.cos(ang) + (YY - 60) * math.sin(ang) * 0.0
            spread = 30 + (YY - 60) * 0.28
            m = np.clip(1 - np.abs((XX - ox) - (YY - 60) * math.tan(ang)) / np.maximum(spread, 1), 0, 1) ** 1.6
            m *= (YY > 60)
            img += m[..., None] * hexc(col) * 0.5
            soft_disk(img, ox, 60, 22, hexc(col), 0.9, 6)
            del d
        for k in range(9):  # empty venue railing / stage edge
            rect(img, 0, PH * 0.82, PW, PH * 0.83, hexc("#2B2B3A"))
        rect(img, 0, PH * 0.83, PW, PH, hexc("#0B0B12"))
        haze = smooth_noise(1, 1, 1)
        del haze
        return hand.finish(f, img, (1.0, 0.98, 1.04), 0.07)
    mux("hh-teodora-soundcheck", frame, n, audio)


def priya_walk():
    speech = tts("Okay, it's Priya. I'm walking home, it's freezing, and I had an idea for next week.|"
                 "What if we did a whole episode on the songs you can't stop humming?|"
                 "Like, why does one tiny piece of music move into your head and just refuse to leave?|"
                 "Theo's going to say it's too nerdy. Theo is wrong.|"
                 "Anyway. Tell us yours. Okay, going inside. Bye.", 18, 1.06)
    dur = len(speech) / SR + 1.6
    n_s = int(dur * SR)
    rng = np.random.default_rng(12)
    street = s.filt(rng.standard_normal(n_s), "lowpass", 400) * 0.05
    tt = np.arange(n_s) / SR
    car = s.filt(rng.standard_normal(n_s), "bandpass", [200, 1800]) * 0.12 * np.exp(-((tt - dur * 0.55) / 2.2) ** 2)
    steps = np.zeros(n_s)
    for st in np.arange(0.3, dur, 60 / 112):
        i = int(st * SR)
        L = int(0.06 * SR)
        steps[i:i + L] += s.filt(rng.standard_normal(L), "bandpass", [300, 2500]) * np.exp(-np.arange(L) / (0.012 * SR)) * 0.12
    voice = np.zeros(n_s)
    voice[int(0.5 * SR):int(0.5 * SR) + len(speech)] = speech[: n_s - int(0.5 * SR)]
    audio = phone_mic(voice + street + car + steps, 0.008, 12)
    n = int(dur * FPS)
    hand = Hand(n, 51, 8, walk=True)
    lights = [(rng.uniform(-200, PW + 200), rng.uniform(150, 700), rng.uniform(20, 60), rng.choice(["#F2B866", "#E9C77B", "#F4EBDD", "#C8695A"])) for _ in range(30)]

    def frame(f):
        t = f / FPS
        img = np.zeros((PH, PW, 3), np.float32)
        img[:] = hexc("#14151C") * (0.6 + 0.4 * (YY[..., None] / PH))
        for i, (x, y, r, col) in enumerate(lights):
            px = (x - t * (18 + r * 0.6)) % (PW + 400) - 200
            soft_disk(img, px, y, r, hexc(col), 0.2, 5, True, 0.5)
        rect(img, 0, PH * 0.8, PW, PH, hexc("#1C1C22"))
        for k in range(8):
            yy = PH * 0.8 + k * 30
            off = (t * 120 + k * 40) % 160
            rect(img, PW / 2 - 4 - k * 4 - off * 0, yy, PW / 2 + 4 + k * 4, yy + 12, hexc("#3A3A40"), 0.6)
        return hand.finish(f, img, (1.0, 0.98, 1.02), 0.08)
    mux("hh-priya-walk", frame, n, audio)


def marlow_porch():
    dur = 28.0
    spb = 60 / 92
    G, D, Em, C = (43, [55, 59, 62, 67]), (42, [54, 57, 62, 66]), (40, [52, 55, 59, 64]), (36, [52, 55, 60, 64])
    bus = s.Bus(dur)
    for bar in range(int(dur / (4 * spb))):
        root, tones = [G, D, Em, C][bar % 4]
        t0 = bar * 4 * spb + 0.4
        for beat in range(4):
            bus.add(s.guitar(root + 12 if beat % 2 == 0 else tones[1], 1.2 * spb, 0.7, 0.5), t0 + beat * spb)
        for beat, idx in ((0.5, 2), (1.5, 3), (2.5, 1), (3, 2), (3.5, 3)):
            bus.add(s.guitar(tones[idx] + 12, 0.9 * spb, 0.5, 0.6), t0 + beat * spb)
    for i, (beat, L, m) in enumerate([(16, 2, 71), (18, 2, 74), (20, 3, 76), (24, 4, 74), (32, 2, 71), (34, 2, 69), (36, 4, 67)]):
        bus.add(s.voice(m, L * spb, 0.42, "oo", 0.15), beat * spb + 0.4)
    x = bus.trim(dur).mean(0)
    rng = np.random.default_rng(14)
    wind = s.filt(rng.standard_normal(len(x)), "bandpass", [80, 900]) * 0.06 * (0.6 + 0.4 * np.sin(np.arange(len(x)) / SR * 0.6))
    audio = phone_mic(x + wind, 0.006, 14)
    n = int(dur * FPS)
    hand = Hand(n, 61, 8)
    leaves = [(rng.uniform(0, PW), rng.uniform(0, 600), rng.uniform(30, 90), rng.choice(["#5F6E56", "#8A967B", "#A7B08F"])) for _ in range(40)]

    def frame(f):
        t = f / FPS
        img = np.zeros((PH, PW, 3), np.float32)
        img[:] = hexc("#DCE3E2") * (1 - 0.25 * YY[..., None] / PH)
        for x, y, r, col in leaves:
            sway = math.sin(t * 0.9 + x * 0.01) * 8
            soft_disk(img, x + sway, y, r, hexc(col), 0.75, 18, False)
        rect(img, 0, PH * 0.55, PW, PH * 0.58, hexc("#F1E6D3"))  # porch rail
        for k in range(9):
            rect(img, k * 76 + 20, PH * 0.58, k * 76 + 38, PH * 0.82, hexc("#EDE2CF"))
        rect(img, 0, PH * 0.82, PW, PH, hexc("#8A6A4A"))
        for k in range(10):
            rect(img, 0, PH * 0.82 + k * 22, PW, PH * 0.82 + k * 22 + 2, hexc("#6E5238"))
        return hand.finish(f, img, (1.02, 1.01, 0.96), 0.035)
    mux("hh-marlow-porch", frame, n, audio)


def yemi_rehearsal():
    dur = 24.0
    spb = 60 / 118
    bus = s.Bus(dur)
    C, F, G = (36, [60, 64, 67]), (41, [60, 65, 69]), (43, [59, 62, 67])
    for bar in range(int(dur / (4 * spb))):
        root, v = [C, F, G, C][bar % 4]
        t0 = bar * 4 * spb + 0.3
        for e in range(16):
            bus.add(s.eguitar(v[(e * 2) % 3] + 12, 0.3 * spb, 0.5), t0 + e * 0.25 * spb, -0.3)
        for beat, note in ((0, root), (0.75, root + 7), (1.5, root + 12), (2.5, root + 7), (3.25, root + 9)):
            bus.add(s.ebass(note, 0.45 * spb, 0.8), t0 + beat * spb)
        for beat in (0, 2):
            bus.add(s.kick(0.8, 1.1, 9), t0 + beat * spb)
        for beat in (1, 3):
            bus.add(s.rim(0.8), t0 + beat * spb)
        for beat, p, sl in ((0.5, 220, False), (1.5, 330, True), (2.25, 220, False), (3.5, 330, True)):
            bus.add(s.conga(0.7, p, sl), t0 + beat * spb)
        for e in range(16):
            bus.add(s.shaker(0.9), t0 + e * 0.25 * spb)
    x = s.reverb(bus.trim(dur), 0.9, 0.3).mean(0)
    audio = phone_mic(x, 0.008, 16)
    n = int(dur * FPS)
    hand = Hand(n, 71, 11)

    def frame(f):
        t = f / FPS
        beat = t / spb
        pulse = math.exp(-(beat % 1) * 4)
        img = np.zeros((PH, PW, 3), np.float32)
        img[:] = hexc("#2A1A14")
        soft_disk(img, PW * 0.2, 160, 200, hexc("#C9832F"), 0.25, 90)
        soft_disk(img, PW * 0.85, 240, 160, hexc("#963F36"), 0.25, 80)
        for k in range(12):  # egg-crate foam
            for j in range(6):
                soft_disk(img, 40 + j * 100 + (k % 2) * 50, 380 + k * 34, 20, hexc("#3B2A22"), 0.6, 8, False)
        rect(img, PW * 0.12, PH * 0.56, PW * 0.48, PH * 0.84, hexc("#1A1210"))  # amp
        rect(img, PW * 0.15, PH * 0.6, PW * 0.45, PH * 0.8, hexc("#3B2A22"))
        soft_disk(img, PW * 0.3, PH * 0.53, 6, hexc("#E9C77B"), 0.6 + 0.4 * pulse, 2)
        for k in range(3):  # congas
            cx = PW * (0.62 + k * 0.13)
            rect(img, cx - 34, PH * (0.6 + k * 0.03), cx + 34, PH * 0.9, hexc("#7A4E2E"))
            soft_disk(img, cx, PH * (0.6 + k * 0.03), 34 + 2 * pulse, hexc("#E8DCC4"), 1.0, 2, False)
        rect(img, 0, PH * 0.88, PW, PH, hexc("#3E2C20"))
        return hand.finish(f, img, (1.08, 0.98, 0.86), 0.06)
    mux("hh-yemi-rehearsal", frame, n, audio)


def halden_tape():
    dur = 26.0
    rng = np.random.default_rng(18)
    n_s = int(dur * SR)
    bus = s.Bus(dur)
    for i, ch in enumerate([[56, 59, 63, 66], [56, 59, 63, 64], [56, 61, 64, 68], [54, 59, 64, 66]] * 2):
        bus.add(s.pad(ch, 3.2, 0.5, 1000, 1.4, 2.0), i * 3.2)
    for st in np.arange(1.0, dur, 1.6):
        bus.add(s.sine_bell(int(rng.choice([71, 68, 75, 73])), 1.0, 0.5), st)
    x = s.tape_wow(s.reverb(bus.trim(dur), 3.0, 0.4).mean(0), 0.003, 0.5)
    rain = s.filt(rng.standard_normal(n_s), "bandpass", [1200, 8000]) * 0.05
    level = np.abs(signal.hilbert(x))
    audio = phone_mic(x * 0.9 + rain, 0.004, 18)
    env24 = [float(level[int(i * SR / FPS):int((i + 1) * SR / FPS)].mean()) for i in range(int(dur * FPS))]
    mx = max(env24)
    n = int(dur * FPS)
    hand = Hand(n, 81, 5)

    def reel(img, cx, cy, r, ang):
        soft_disk(img, cx, cy, r, hexc("#3B3A36"), 1.0, 1.5, False)
        soft_disk(img, cx, cy, r * 0.9, hexc("#5A4A3A"), 1.0, 1.5, False)
        soft_disk(img, cx, cy, r * 0.42, hexc("#BDB6A6"), 1.0, 1.5, False)
        for k in range(3):
            a = ang + k * 2 * math.pi / 3
            soft_disk(img, cx + math.cos(a) * r * 0.25, cy + math.sin(a) * r * 0.25, r * 0.09, hexc("#3B3A36"), 1.0, 1.5, False)
        soft_disk(img, cx, cy, r * 0.08, hexc("#292722"), 1.0, 1.5, False)

    def frame(f):
        t = f / FPS
        img = np.zeros((PH, PW, 3), np.float32)
        img[:] = hexc("#2E2B27")
        soft_disk(img, PW * 0.7, 120, 220, hexc("#9FB4BA"), 0.18, 120)  # window light
        rect(img, PW * 0.05, PH * 0.18, PW * 0.95, PH * 0.82, hexc("#B8B1A2"))
        rect(img, PW * 0.07, PH * 0.2, PW * 0.93, PH * 0.8, hexc("#CFC8B8"))
        reel(img, PW * 0.3, PH * 0.34, 120, t * 2.4)
        reel(img, PW * 0.7, PH * 0.34, 120, t * 2.1)
        rect(img, PW * 0.3, PH * 0.47, PW * 0.7, PH * 0.475, hexc("#4A3628"))
        for i, cx in enumerate((PW * 0.3, PW * 0.7)):  # VU meters
            x0, y0 = cx - 90, PH * 0.56
            rect(img, x0, y0, x0 + 180, y0 + 110, hexc("#E9C77B"))
            lv = env24[min(f, len(env24) - 1)] / mx
            ang = -1.0 + 1.6 * lv + 0.05 * math.sin(t * 7 + i)
            for k in range(60):
                px = cx + math.sin(ang) * k * 1.4
                py = y0 + 100 - math.cos(ang) * k * 1.4
                rect(img, px - 1, py - 1, px + 1, py + 1, hexc("#292722"))
        return hand.finish(f, img, (1.0, 1.0, 0.98), 0.05)
    mux("hh-halden-tape", frame, n, audio)


CLIPS = {
    "hh-juniper-2am": juniper_2am, "hh-cass-bridge": cass_bridge, "hh-imani-radio": imani_radio,
    "hh-teodora-soundcheck": teodora_soundcheck, "hh-priya-walk": priya_walk, "hh-marlow-porch": marlow_porch,
    "hh-yemi-rehearsal": yemi_rehearsal, "hh-halden-tape": halden_tape,
}

if __name__ == "__main__":
    for c in sys.argv[1:] or list(CLIPS):
        CLIPS[c]()

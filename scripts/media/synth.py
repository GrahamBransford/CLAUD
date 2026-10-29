"""
Small numpy synthesis toolkit used to produce the prototype's original demo
music. Nothing here is meant to be clever DSP; it is meant to be quick to
compose with and to sound warm enough to carry a product demo.
"""
import numpy as np
from scipy import signal

SR = 44100
RNG = np.random.default_rng(7)


def hz(midi):
    return 440.0 * 2 ** ((np.asarray(midi, dtype=float) - 69) / 12)


def tt(dur):
    return np.arange(int(max(dur, 0) * SR)) / SR


def noise(n, rng=RNG):
    return rng.standard_normal(n)


def sos(kind, freq, order=2):
    nyq = SR / 2
    if isinstance(freq, (list, tuple)):
        wn = [min(f / nyq, 0.99) for f in freq]
    else:
        wn = min(freq / nyq, 0.99)
    return signal.butter(order, wn, btype=kind, output="sos")


def filt(x, kind, freq, order=2):
    return signal.sosfilt(sos(kind, freq, order), x, axis=-1)


def adsr(n, a=0.005, d=0.1, s=0.7, r=0.1, gate=None):
    """Envelope for n samples. gate = seconds the note is held."""
    gate = n / SR - r if gate is None else gate
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-6), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-6)))
    rel = t > gate
    if rel.any():
        g_level = e[min(int(gate * SR), n - 1)]
        e[rel] = g_level * np.exp(-(t[rel] - gate) / max(r / 4, 1e-6))
    return e


def fade(x, fin=0.003, fout=0.01):
    n = x.shape[-1]
    a, b = int(fin * SR), int(fout * SR)
    if a:
        x[..., :a] *= np.linspace(0, 1, a)
    if b and b < n:
        x[..., -b:] *= np.linspace(1, 0, b)
    return x


# ---------------------------------------------------------------- mix buffer

class Bus:
    def __init__(self, dur):
        self.n = int(dur * SR) + SR * 6
        self.buf = np.zeros((2, self.n))

    def add(self, x, t, pan=0.0, gain=1.0):
        """Place mono (n,) or stereo (2,n) audio at time t (seconds)."""
        i = int(round(t * SR))
        if i >= self.n or i < 0:
            return
        if x.ndim == 1:
            ang = (pan + 1) * np.pi / 4
            x = np.vstack([x * np.cos(ang), x * np.sin(ang)]) * np.sqrt(2)
        m = min(x.shape[1], self.n - i)
        self.buf[:, i:i + m] += x[:, :m] * gain

    def trim(self, dur):
        return self.buf[:, :int(dur * SR)]


# ---------------------------------------------------------------- drums

def kick(vel=1.0, tone=1.0, decay=7.0):
    t = tt(0.6)
    f = 44 * tone + 95 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t * decay)
    click = filt(noise(len(t)), "lowpass", 3000) * np.exp(-t * 250) * 0.25
    return np.tanh(1.6 * (x + click)) * vel


def snare(vel=1.0, tone=190, snappy=1.0, decay=16):
    t = tt(0.45)
    body = np.sin(2 * np.pi * tone * t) * np.exp(-t * 22) * 0.55
    body += np.sin(2 * np.pi * tone * 1.6 * t) * np.exp(-t * 30) * 0.2
    n = filt(noise(len(t)), "bandpass", [1200, 9000]) * np.exp(-t * decay) * 0.8 * snappy
    return np.tanh((body + n) * 1.2) * vel


def brush(vel=1.0, length=0.35):
    t = tt(length + 0.1)
    e = np.minimum(t / 0.03, 1) * np.exp(-t * 6)
    return filt(noise(len(t)), "bandpass", [1500, 8000]) * e * 0.35 * vel


def _metal(t, base=1.0):
    freqs = np.array([205.3, 304.4, 369.6, 522.7, 540.0, 800.0]) * base * 2.2
    x = sum(signal.square(2 * np.pi * f * t + RNG.uniform(0, 6)) for f in freqs)
    return x / len(freqs)


def hat(vel=1.0, open_=False):
    length = 0.45 if open_ else 0.09
    t = tt(length)
    x = _metal(t) * 0.6 + noise(len(t)) * 0.4
    x = filt(x, "highpass", 7000, 3)
    return x * np.exp(-t * (9 if open_ else 55)) * 0.5 * vel


def ride(vel=1.0):
    t = tt(1.6)
    x = _metal(t, 1.35) * 0.5 + noise(len(t)) * 0.3
    x = filt(x, "bandpass", [3000, 12000])
    bell = sum(np.sin(2 * np.pi * f * t) for f in (2950, 4410, 5230)) * 0.06
    return (x * np.exp(-t * 3.2) + bell * np.exp(-t * 6)) * 0.4 * vel


def shaker(vel=1.0):
    t = tt(0.12)
    e = np.sin(np.pi * np.minimum(t / 0.09, 1)) ** 2
    return filt(noise(len(t)), "bandpass", [4500, 11000]) * e * 0.28 * vel


def rim(vel=1.0):
    t = tt(0.08)
    x = np.sin(2 * np.pi * 1750 * t) * 0.5 + filt(noise(len(t)), "bandpass", [2000, 6000]) * 0.5
    return x * np.exp(-t * 90) * vel * 0.7


def bell(vel=1.0, pitch=1.0):
    t = tt(0.5)
    x = np.sin(2 * np.pi * 1180 * pitch * t) + 0.5 * np.sin(2 * np.pi * 2710 * pitch * t)
    return x * np.exp(-t * 14) * 0.3 * vel


def conga(vel=1.0, pitch=220, slap=False):
    t = tt(0.5)
    f = pitch * (1 + 0.25 * np.exp(-t * 60))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t * (14 if not slap else 22)) + 0.2 * np.sin(2 * ph) * np.exp(-t * 20)
    if slap:
        x += filt(noise(len(t)), "bandpass", [800, 5000]) * np.exp(-t * 60) * 0.5
    return x * 0.6 * vel


def clap(vel=1.0):
    t = tt(0.4)
    e = np.zeros(len(t))
    for off in (0, 0.011, 0.022):
        i = int(off * SR)
        e[i:] += np.exp(-(t[: len(t) - i]) * 90)
    e += np.exp(-t * 14) * 0.5
    return filt(noise(len(t)), "bandpass", [900, 6000]) * e * 0.5 * vel


# ---------------------------------------------------------------- strings

def karplus(midi, dur, bright=0.6, decay=0.996, pluck_pos=0.18, rng=RNG):
    """Karplus-Strong string via an IIR comb (lfilter), with fractional tuning."""
    f = float(hz(midi))
    P = SR / f - 0.5
    N = int(np.floor(P))
    frac = P - N
    n = int((dur + 0.05) * SR)
    burst = noise(N + 1, rng)
    burst = filt(burst, "lowpass", 800 + 9000 * bright)
    # pluck position comb for a less synthetic tone
    d = max(1, int(N * pluck_pos))
    burst[d:] -= 0.8 * burst[:-d]
    x = np.zeros(n)
    x[: N + 1] = burst
    # loop filter = two-point average convolved with a linear-interp fractional delay
    a = np.zeros(N + 3)
    a[0] = 1
    a[N] = -decay * 0.5 * (1 - frac)
    a[N + 1] = -decay * 0.5
    a[N + 2] = -decay * 0.5 * frac
    y = signal.lfilter([1.0], a, x)
    y = y / (np.abs(y[: N * 4]).max() + 1e-9)
    return fade(y[:n], 0.001, 0.04)


def guitar(midi, dur, vel=1.0, bright=0.55, body=True):
    y = karplus(midi, dur, bright=bright, decay=0.9975)
    if body:
        res = (filt(y, "bandpass", [90, 130]) * 1.2 + filt(y, "bandpass", [180, 260]) * 0.8
               + filt(y, "bandpass", [380, 520]) * 0.5)
        y = y * 0.8 + res
    return y * vel * 0.5


def upright(midi, dur, vel=1.0):
    y = karplus(midi, dur, bright=0.25, decay=0.997, pluck_pos=0.3)
    t = tt(len(y) / SR)
    thump = np.sin(2 * np.pi * float(hz(midi)) * t) * np.exp(-t * 6)
    y = filt(y * 0.6 + thump * 0.7, "lowpass", 1100)
    return fade(y * adsr(len(y), 0.004, 0.6, 0.5, 0.08, gate=dur), 0.002, 0.03) * vel * 0.8


def eguitar(midi, dur, vel=1.0):
    y = karplus(midi, dur, bright=0.85, decay=0.996, pluck_pos=0.12)
    y = filt(y, "bandpass", [180, 5200])
    return np.tanh(y * 1.4) * vel * 0.38


# ---------------------------------------------------------------- keys

def rhodes(midi, dur, vel=0.8):
    f = float(hz(midi))
    t = tt(dur + 1.2)
    idx = (0.8 + 2.4 * vel) * np.exp(-t * 3.2) + 0.25
    mod = np.sin(2 * np.pi * f * t)
    x = np.sin(2 * np.pi * f * t + idx * mod)
    tine = np.sin(2 * np.pi * f * 7.1 * t) * np.exp(-t * 28) * 0.18 * vel
    env = adsr(len(t), 0.002, 1.6 + 400 / f, 0.15, 0.25, gate=dur)
    y = (x + tine) * env
    return fade(y, 0.001, 0.05) * vel * 0.32


def piano(midi, dur, vel=0.8):
    f = float(hz(midi))
    t = tt(dur + 1.5)
    B = 0.00035
    y = np.zeros(len(t))
    for k in range(1, 14):
        fk = k * f * np.sqrt(1 + B * k * k)
        if fk > SR / 2.2:
            break
        amp = (1 / k ** 1.25) * (0.6 + 0.4 * vel) ** (k * 0.35)
        dec = 1.2 + 0.55 * k + f / 300
        det = 1 + RNG.uniform(-0.0006, 0.0006)
        y += amp * (np.sin(2 * np.pi * fk * t) + 0.6 * np.sin(2 * np.pi * fk * det * t)) * (
            0.65 * np.exp(-t * dec) + 0.35 * np.exp(-t * dec * 0.18))
    ham = filt(noise(len(t)), "bandpass", [600, 4000]) * np.exp(-t * 120) * 0.05 * vel
    env = adsr(len(t), 0.001, 10, 1.0, 0.18, gate=dur)
    return fade((y + ham) * env, 0.001, 0.05) * vel * 0.22


def saw(f, t, detune_cents=0.0):
    ff = f * 2 ** (detune_cents / 1200)
    return 2 * ((ff * t + RNG.uniform()) % 1) - 1


def pad(midis, dur, vel=0.6, cutoff=1800, attack=0.8, release=1.6):
    t = tt(dur + release)
    y = np.zeros(len(t))
    for m in midis:
        f = float(hz(m))
        for c in (-9, 0, 8):
            y += saw(f, t, c)
    y = filt(y / (3 * len(midis)), "lowpass", cutoff, 2)
    env = adsr(len(t), attack, 1.0, 0.85, release, gate=dur)
    return y * env * vel * 0.9


def arp_synth(midi, dur, vel=0.7, bright=0.5):
    f = float(hz(midi))
    t = tt(dur + 0.3)
    raw = 0.6 * saw(f, t, 4) + 0.4 * signal.square(2 * np.pi * f * t)
    dark = filt(raw, "lowpass", 500)
    br = filt(raw, "lowpass", 1500 + 4500 * bright)
    fe = np.exp(-t * 12)
    y = br * fe + dark * (1 - fe)
    return fade(y * adsr(len(t), 0.003, 0.25, 0.35, 0.12, gate=dur), 0.001, 0.02) * vel * 0.3


def synth_bass(midi, dur, vel=0.9):
    f = float(hz(midi))
    t = tt(dur + 0.15)
    y = np.sin(2 * np.pi * f * t) + 0.35 * filt(saw(f, t), "lowpass", 600)
    return fade(np.tanh(1.3 * y) * adsr(len(t), 0.004, 0.2, 0.75, 0.06, gate=dur), 0.002, 0.02) * vel * 0.5


def ebass(midi, dur, vel=0.9):
    f = float(hz(midi))
    t = tt(dur + 0.15)
    y = np.sin(2 * np.pi * f * t) + 0.22 * np.sin(4 * np.pi * f * t) + 0.08 * np.sin(6 * np.pi * f * t)
    y *= adsr(len(t), 0.006, 0.5, 0.55, 0.07, gate=dur)
    return fade(filt(np.tanh(1.5 * y), "lowpass", 1400), 0.002, 0.02) * vel * 0.55


def horn(midi, dur, vel=0.8):
    f = float(hz(midi))
    t = tt(dur + 0.2)
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t) * np.minimum(t / 0.4, 1)
    ph = np.cumsum(f * vib) / SR
    raw = 2 * ((ph + RNG.uniform()) % 1) - 1
    fe = np.minimum(t / 0.05, 1) * (0.5 + 0.5 * np.exp(-t * 4))
    y = filt(raw, "lowpass", 900) * (1 - fe) + filt(raw, "lowpass", 3200) * fe
    return fade(y * adsr(len(t), 0.03, 0.3, 0.8, 0.08, gate=dur), 0.005, 0.03) * vel * 0.3


VOWELS = {
    "oo": [(300, 1.0, 60), (870, 0.35, 90), (2240, 0.1, 120)],
    "ah": [(730, 1.0, 80), (1090, 0.6, 90), (2440, 0.25, 120)],
    "oh": [(500, 1.0, 70), (850, 0.5, 90), (2400, 0.15, 120)],
    "mm": [(260, 1.0, 50), (1900, 0.03, 200), (2600, 0.02, 200)],
}


def voice(midi, dur, vel=0.7, vowel="oo", breath=0.08, rng=RNG):
    """Wordless formant 'ooh' — a glottal pulse through vowel resonances."""
    f = float(hz(midi))
    t = tt(dur + 0.4)
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.3 * t + rng.uniform(0, 6)) * np.minimum(t / 0.5, 1)
    scoop = 1 - 0.03 * np.exp(-t * 18)
    ph = np.cumsum(f * vib * scoop) / SR
    src = (2 * (ph % 1) - 1) + breath * noise(len(t), rng)
    src = filt(src, "lowpass", 4000)
    y = np.zeros(len(t))
    for F, g, bw in VOWELS[vowel]:
        y += g * filt(src, "bandpass", [max(F - bw, 40), F + bw])
    env = adsr(len(t), 0.06, 0.4, 0.85, 0.25, gate=dur)
    return fade(y * env, 0.01, 0.06) * vel * 1.6


def sine_bell(midi, dur, vel=0.6):
    f = float(hz(midi))
    t = tt(dur + 2.0)
    y = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 3)
    y += 0.12 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 8)
    return fade(y * np.exp(-t * 1.4), 0.002, 0.1) * vel * 0.25


# ---------------------------------------------------------------- fx

def reverb(x, decay=2.2, mix=0.25, predelay=0.02, tone=5000, seed=3):
    """Stereo convolution reverb from decaying filtered noise."""
    rng = np.random.default_rng(seed)
    n = int(decay * SR * 1.2)
    t = np.arange(n) / SR
    env = np.exp(-t * 6.9 / decay)
    irs = []
    for ch in range(2):
        ir = rng.standard_normal(n) * env
        dark = filt(ir, "lowpass", tone * 0.35)
        mixc = np.exp(-t * 3 / decay)
        ir = filt(ir, "lowpass", tone) * mixc + dark * (1 - mixc)
        ir = np.concatenate([np.zeros(int(predelay * SR)), ir])
        irs.append(ir / np.sqrt(np.sum(ir ** 2)))
    if x.ndim == 1:
        x = np.vstack([x, x])
    wet = np.vstack([signal.fftconvolve(x[c], irs[c])[: x.shape[1]] for c in range(2)])
    return x * (1 - mix) + wet * mix * 1.4


def delay(x, time, fb=0.35, mix=0.25, tone=3500, pingpong=True):
    d = int(time * SR)
    if x.ndim == 1:
        x = np.vstack([x, x])
    out = x.copy()
    tap = x.copy()
    for i in range(1, 7):
        tap = filt(tap, "lowpass", tone) * fb
        sh = np.zeros_like(tap)
        sh[:, d * i:] = tap[:, : tap.shape[1] - d * i] if d * i < tap.shape[1] else 0
        if pingpong and i % 2 == 1:
            sh = sh[::-1]
        out += sh * mix / fb
        tap = x * fb ** (i + 1)
    return out


def chorus(x, depth=0.003, rate=0.6):
    if x.ndim == 1:
        x = np.vstack([x, x])
    n = x.shape[1]
    idx = np.arange(n)
    out = np.empty_like(x)
    for c, phs in enumerate((0, np.pi / 2)):
        mod = (0.012 + depth * np.sin(2 * np.pi * rate * idx / SR + phs)) * SR
        out[c] = 0.6 * x[c] + 0.5 * np.interp(idx - mod, idx, x[c])
    return out


def tape_wow(x, depth=0.0018, rate=0.45, flutter=0.0003):
    n = x.shape[-1]
    idx = np.arange(n)
    mod = (depth * np.sin(2 * np.pi * rate * idx / SR) + flutter * np.sin(2 * np.pi * 6.1 * idx / SR)) * SR
    pos = np.clip(idx + mod * 10, 0, n - 1)
    if x.ndim == 1:
        return np.interp(pos, idx, x)
    return np.vstack([np.interp(pos, idx, x[c]) for c in range(x.shape[0])])


def crackle(n, density=6, level=0.04, rng=RNG):
    y = filt(noise(n, rng), "bandpass", [800, 7000]) * 0.08
    pops = np.zeros(n)
    k = int(n / SR * density)
    pos = rng.integers(0, n - 200, k)
    for p in pos:
        L = rng.integers(20, 120)
        pops[p:p + L] += rng.standard_normal(L) * np.exp(-np.arange(L) / 15) * rng.uniform(0.3, 1.5)
    return (y + filt(pops, "highpass", 900)) * level


def duck(x, times, depth=0.45, release=0.25):
    """Simple sidechain pump keyed from kick times."""
    n = x.shape[-1]
    g = np.ones(n)
    L = int(release * 3 * SR)
    curve = 1 - depth * np.exp(-np.arange(L) / (release * SR))
    for tm in times:
        i = int(tm * SR)
        if i >= n:
            continue
        m = min(L, n - i)
        g[i:i + m] = np.minimum(g[i:i + m], curve[:m])
    return x * g


REF_BANDS = [(20, 150, -3), (150, 600, -5.5), (600, 2000, -9), (2000, 5000, -14), (5000, 10000, -19), (10000, 20000, -27)]


def match_eq(x, dark=0.0, limit=7.0):
    """Linear-phase tonal correction toward a reference mix curve.
    `dark` tilts the target down above 2 kHz (dB) for lo-fi material."""
    mono = x.mean(0)
    fr, P = signal.welch(mono, SR, nperseg=8192)
    tot = P.sum()
    centers, gains = [], []
    for i, (a, b, ref) in enumerate(REF_BANDS):
        have = 10 * np.log10(P[(fr >= a) & (fr < b)].sum() / tot + 1e-12)
        target = ref - (dark * (i - 2) / 3 if i > 2 else 0)
        centers.append(np.sqrt(a * b))
        gains.append(np.clip(target - have, -limit, limit))
    n = x.shape[1]
    F = np.fft.rfftfreq(n, 1 / SR)
    g_db = np.interp(np.log10(np.maximum(F, 20)), np.log10(centers), gains)
    G = 10 ** (g_db / 20)
    return np.vstack([np.fft.irfft(np.fft.rfft(x[c]) * G, n) for c in range(x.shape[0])])


def master(x, target_rms_db=-15.0, hp=28, dark=0.0):
    x = filt(x, "highpass", hp)
    x = match_eq(x, dark)
    x = match_eq(x, dark, 3.0)
    rms = np.sqrt(np.mean(x ** 2))
    x = x * (10 ** (target_rms_db / 20) / (rms + 1e-9))
    x = np.tanh(x * 1.05) / np.tanh(1.05)
    peak = np.abs(x).max()
    if peak > 0.97:
        x *= 0.97 / peak
    return x


def write_wav(path, x):
    from scipy.io import wavfile
    y = np.clip(x, -1, 1)
    if y.ndim == 2:
        y = y.T
    wavfile.write(path, SR, (y * 32767).astype(np.int16))

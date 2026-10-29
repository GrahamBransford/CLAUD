"""
Voices the four demo podcast episodes with a local neural TTS model and
cuts the editorial highlight from each full episode.

Writes to $WORK/podcasts:
  <id>.full.wav, <id>.highlight.wav, <id>.json (cues, chapters, highlight range)
"""
import json
import os
import re
import sys

import numpy as np
from scipy import signal

import synth as s
from synth import SR

ROOT = os.path.dirname(os.path.abspath(__file__)) + "/../.."
WORK = os.environ.get("WORK", "/tmp/claude-0/work")
VOICE = os.environ.get("PIPER_VOICE", f"{WORK}/voices/en-us-libritts-high.onnx")
OUT = f"{WORK}/podcasts"
os.makedirs(OUT, exist_ok=True)

THEMES = {  # (voicings, instrument) for a short show sting
    "in-defense-of-boredom": ([[62, 66, 69, 73], [59, 62, 66, 69], [55, 59, 62, 66], [57, 61, 64, 69]], "rhodes"),
    "the-bassline": ([[48, 55, 59, 64], [53, 57, 60, 64], [50, 57, 60, 65], [55, 59, 62, 65]], "piano"),
    "what-an-old-radio-knows": ([[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67], [52, 55, 59, 64]], "bell"),
    "who-gets-paid": ([[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]], "rhodes"),
}


def parse(path):
    speakers, lines, chapters = {}, [], []
    hl = []
    for raw in open(path):
        line = raw.strip()
        if not line:
            continue
        if line.startswith("@"):
            key, rest = line[1:].split("=", 1)
            name, sid = rest.split("|")
            speakers[key.strip()] = {"name": name.strip(), "voice": int(sid)}
        elif line.startswith("## HIGHLIGHT"):
            hl.append(("start" if "START" in line else "end", len(lines)))
        elif line.startswith("#"):
            chapters.append({"title": line.lstrip("# ").strip(), "line": len(lines)})
        else:
            m = re.match(r"([A-Z]+):\s*(.*)", line)
            lines.append({"speaker": m.group(1), "text": m.group(2)})
    return speakers, lines, chapters, dict(hl)


def theme(kind, voicings, bpm=88):
    spb = 60 / bpm
    bus = s.Bus(len(voicings) * 2 * spb + 4)
    for i, v in enumerate(voicings):
        for j, m in enumerate(v):
            if kind == "rhodes":
                x = s.rhodes(m, 1.8 * spb, 0.7)
            elif kind == "piano":
                x = s.piano(m, 1.8 * spb, 0.6)
            else:
                x = s.sine_bell(m + 12, 1.5 * spb, 0.7)
            bus.add(x, i * 2 * spb + j * 0.03 * (kind == "bell") * 4, -0.3 + j * 0.2)
        bus.add(s.upright(v[0] - 12 if v[0] > 52 else v[0] - 12 + 12 - 12, 1.8 * spb, 0.8), i * 2 * spb)
    x = s.reverb(bus.buf, 2.5, 0.3)
    return x.mean(0) / (np.abs(x).max() + 1e-9) * 0.35


def process_voice(x, sr_in):
    y = signal.resample_poly(x, SR, sr_in)
    y = s.filt(y, "highpass", 80)
    # gentle presence + warmth
    y = y + 0.25 * s.filt(y, "bandpass", [2500, 5000]) + 0.15 * s.filt(y, "lowpass", 220)
    return y


def main(ep_id):
    from piper import PiperVoice
    from piper.config import SynthesisConfig

    voice = PiperVoice.load(VOICE, config_path=VOICE + ".json")
    speakers, lines, chapters, hl = parse(f"{ROOT}/content/podcasts/{ep_id}.txt")
    rng = np.random.default_rng(len(ep_id))
    pieces, cues = [], []
    intro = theme(THEMES[ep_id][1], THEMES[ep_id][0])
    t = 0.0
    lead_in = 3.2  # speech starts over the tail of the theme
    t = lead_in
    line_start = []
    prev_speaker = None
    for li, ln in enumerate(lines):
        sp = speakers[ln["speaker"]]
        cfg = SynthesisConfig(speaker_id=sp["voice"], length_scale=1.17, noise_scale=0.6, noise_w_scale=0.75)
        gap = rng.uniform(0.35, 0.6) if prev_speaker != ln["speaker"] else 0.25
        if prev_speaker is not None:
            t += gap
        line_start.append(t)
        for sentence in re.split(r"(?<=[.?!])\s+", ln["text"]):
            chunks = list(voice.synthesize(sentence, syn_config=cfg))
            if not chunks:
                continue
            a = process_voice(np.concatenate([c.audio_float_array for c in chunks]), chunks[0].sample_rate)
            a = a / (np.sqrt(np.mean(a ** 2)) + 1e-9) * 0.09
            # trim leading/trailing near-silence so pacing stays conversational
            env = np.abs(a) > 0.01
            if env.any():
                i0 = max(0, np.argmax(env) - int(0.03 * SR))
                i1 = min(len(a), len(a) - np.argmax(env[::-1]) + int(0.08 * SR))
                a = a[i0:i1]
            pieces.append((t, a))
            cues.append({"start": round(t, 2), "end": round(t + len(a) / SR, 2),
                         "speaker": ln["speaker"], "text": sentence.strip(), "line": li})
            t += len(a) / SR + 0.16
        prev_speaker = ln["speaker"]
    speech_end = t
    total = speech_end + 6.5
    out = np.zeros(int(total * SR) + SR)
    for st, a in pieces:
        i = int(st * SR)
        out[i:i + len(a)] += a
    # intro theme ducked under the first line, outro theme after the last
    ii = intro.copy()
    duck_at = int(lead_in * SR)
    ii[duck_at:] *= np.linspace(1, 0.12, len(ii) - duck_at) if len(ii) > duck_at else 1
    out[:len(ii)] += ii
    oi = int((speech_end + 0.4) * SR)
    m = min(len(intro), len(out) - oi)
    out[oi:oi + m] += intro[:m]
    out += s.filt(s.noise(len(out)), "lowpass", 3000) * 0.0012  # room tone
    out = out / (np.abs(out).max() + 1e-9) * 0.89

    # chapters → seconds
    for ch in chapters:
        ch["start"] = round(line_start[ch["line"]] - (0.6 if ch["line"] else lead_in), 2)
        ch["start"] = max(0.0, ch["start"])
        del ch["line"]
    h0 = line_start[hl["start"]] - 0.35
    h1 = line_start[hl["end"]] - 0.25 if hl["end"] < len(lines) else speech_end
    seg = out[int(h0 * SR):int(h1 * SR)].copy()
    seg[: int(0.25 * SR)] *= np.linspace(0, 1, int(0.25 * SR))
    seg[-int(0.8 * SR):] *= np.linspace(1, 0, int(0.8 * SR))
    hcues = [{**c, "start": round(c["start"] - h0, 2), "end": round(c["end"] - h0, 2)}
             for c in cues if c["start"] >= h0 and c["end"] <= h1 + 0.1]

    s.write_wav(f"{OUT}/{ep_id}.full.wav", out[: int(total * SR)])
    s.write_wav(f"{OUT}/{ep_id}.highlight.wav", seg)
    # per-frame speaking envelopes (15 fps) for the studio video renderer
    fps = 15
    envs = {}
    for key in speakers:
        e = np.zeros(int(total * fps) + 2)
        for c in cues:
            if c["speaker"] == key:
                e[int(c["start"] * fps):int(c["end"] * fps) + 1] = 1
        envs[key] = e.tolist()
    lvl = [float(np.sqrt(np.mean(out[i:i + SR // fps] ** 2))) for i in range(0, len(out), SR // fps)]
    json.dump({
        "id": ep_id, "speakers": speakers, "duration": round(total, 2),
        "highlight": {"start": round(h0, 2), "end": round(h1, 2), "duration": round(h1 - h0, 2)},
        "chapters": chapters, "cues": cues, "highlightCues": hcues,
        "speaking15": envs, "level15": [round(v, 4) for v in lvl],
    }, open(f"{OUT}/{ep_id}.json", "w"))
    print(f"{ep_id}: full {total / 60:.1f} min, highlight {(h1 - h0) / 60:.1f} min ({h0:.0f}s-{h1:.0f}s)")


if __name__ == "__main__":
    for e in sys.argv[1:] or list(THEMES):
        main(e)

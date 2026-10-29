"""
Composes the six original demo songs. Each song writes:
  work/audio/<id>.wav         mastered stereo mix
  work/audio/<id>.events.json beat grid, sections and accents for the video renderer
"""
import json
import zlib
import os
import sys

import numpy as np

import synth as s
from synth import SR

OUT = os.environ.get("WORK", "/tmp/claude-0/work") + "/audio"
os.makedirs(OUT, exist_ok=True)


class Song:
    def __init__(self, sid, bpm, bars, beats=4, swing=0.0):
        self.id, self.bpm, self.bars, self.beats, self.swing = sid, bpm, bars, beats, swing
        self.spb = 60.0 / bpm
        self.dur = bars * beats * self.spb + 4.0
        self.buses = {}
        self.sections = []
        self.accents = {"kick": [], "snare": [], "hit": []}
        self.rng = np.random.default_rng(zlib.crc32(sid.encode()))

    def t(self, bar, beat=0.0):
        """Time of a beat position; 8th-note offbeats are swung."""
        frac = beat % 1
        if self.swing and abs(frac - 0.5) < 1e-6:
            beat = beat - 0.5 + 0.5 + self.swing * 0.5
        return (bar * self.beats + beat) * self.spb

    def bus(self, name):
        if name not in self.buses:
            self.buses[name] = s.Bus(self.dur)
        return self.buses[name]

    def hit(self, name, x, bar, beat, pan=0.0, gain=1.0, human=0.006):
        tm = self.t(bar, beat) + self.rng.normal(0, human)
        self.bus(name).add(x, max(tm, 0), pan, gain)
        return tm

    def section(self, name, start, length, energy):
        self.sections.append({"name": name, "start": self.t(start), "end": self.t(start + length),
                              "bar": start, "bars": length, "energy": energy})

    def render(self, mix, post=None, target=-15.0, preview_target=75, dark=0.0):
        out = np.zeros((2, int(self.dur * SR)))
        for name, (gain, fx) in mix.items():
            if name not in self.buses:
                continue
            x = self.buses[name].trim(self.dur)
            if fx:
                x = fx(x)
            out += x * gain
        if post:
            out = post(out)
        out = s.master(out, target, dark=dark)
        # tail fade at the real end of the arrangement
        end = int((self.bars * self.beats * self.spb + 3.0) * SR)
        out = out[:, :end]
        out[:, -int(2.5 * SR):] *= np.linspace(1, 0, int(2.5 * SR)) ** 2
        s.write_wav(f"{OUT}/{self.id}.wav", out)
        # preview ends at the section boundary closest to the editorial target
        bounds = [sec["end"] for sec in self.sections]
        prev = min([b for b in bounds if 60 <= b <= 90] or bounds, key=lambda b: abs(b - preview_target))
        beats = [self.t(b // self.beats, b % self.beats) for b in range(self.bars * self.beats)]
        mono = out.mean(0)
        hop = SR // 24
        rms = [float(np.sqrt(np.mean(mono[i:i + hop] ** 2))) for i in range(0, len(mono), hop)]
        mx = max(rms) or 1
        json.dump({"id": self.id, "bpm": self.bpm, "beatsPerBar": self.beats, "duration": end / SR,
                   "previewEnd": round(prev, 2), "beats": beats, "sections": self.sections,
                   "accents": self.accents, "rms24": [round(r / mx, 3) for r in rms]},
                  open(f"{OUT}/{self.id}.events.json", "w"))
        print(f"{self.id}: {end / SR:.1f}s, preview {prev:.1f}s")


def active(song, bar, ranges):
    return any(a <= bar < b for a, b in ranges)


# ======================================================================
# 1. Paper Moons — Juniper Vale — bedroom soul, 84 bpm
# ======================================================================

def paper_moons():
    S = Song("paper-moons", 84, 44, swing=0.16)
    chords = [  # bass, rhodes voicing
        (38, [53, 57, 60, 64]),  # Dm9
        (43, [53, 59, 64, 69]),  # G13
        (36, [52, 55, 59, 62]),  # Cmaj9
        (45, [55, 61, 64, 70]),  # A7b9
    ]
    S.section("Intro", 0, 4, 0.25)
    S.section("Verse", 4, 8, 0.6)
    S.section("Chorus", 12, 8, 0.9)
    S.section("Verse", 20, 4, 0.6)
    S.section("Verse", 24, 4, 0.6)
    S.section("Chorus", 28, 8, 1.0)
    S.section("Outro", 36, 8, 0.35)
    drums = [(4, 36)]
    bass_on = [(4, 40)]
    voice_on = [(12, 20), (28, 36)]
    for bar in range(S.bars):
        b, v = chords[bar % 4]
        vel = 0.75 if bar >= 4 else 0.6
        # rhodes comping
        for beat, length, vv in ((0, 1.4, 1.0), (1.5, 0.4, 0.6), (2.5, 1.2, 0.85), (3.5, 0.45, 0.55)):
            if bar >= 40 and beat > 0:
                continue
            for i, m in enumerate(v):
                S.hit("keys", s.rhodes(m, length * S.spb, vel * vv), bar, beat + i * 0.012,
                      pan=-0.3 + i * 0.2, human=0.003)
        if active(S, bar, bass_on):
            nxt = chords[(bar + 1) % 4][0]
            for beat, note, L in ((0, b, 1.3), (1.75, b + 7, 0.5), (2.5, b + 12, 0.7), (3.5, nxt - 1, 0.4)):
                S.hit("bass", s.ebass(note, L * S.spb, 0.9), bar, beat)
        if active(S, bar, drums):
            for beat in (0, 1.75, 2.5):
                S.accents["kick"].append(S.hit("drums", s.kick(0.9, 1.0, 8), bar, beat))
            for beat in (1, 3):
                S.accents["snare"].append(S.hit("drums", s.snare(0.7, 200, 0.7, 18), bar, beat + 0.04))
            for e in range(8):
                S.hit("drums", s.hat(0.35 + 0.25 * (e % 2 == 0) + S.rng.uniform(0, 0.1)), bar, e * 0.5, pan=0.35)
            S.hit("drums", s.snare(0.12, 220, 0.5), bar, 2.75, pan=0.1)
            if bar % 4 == 3:
                S.hit("drums", s.hat(0.4, True), bar, 3.5, pan=0.35)
    # wordless vocal melody (D dorian), two-bar phrases over the 4-bar loop
    phrase = [(0, 1.0, 69), (1, 0.5, 72), (1.5, 1.5, 74), (3, 1, 72),
              (4, 1.5, 69), (5.5, 0.5, 67), (6, 2, 65),
              (8, 1, 69), (9, 0.5, 72), (9.5, 1.5, 74), (11, 1, 76),
              (12, 1.5, 74), (13.5, 0.5, 72), (14, 2, 69)]
    for start, end in voice_on:
        for rep in range(start, end, 4):
            for beat, L, m in phrase:
                S.hit("vox", s.voice(m, L * S.spb * 0.95, 0.55, "oo"), rep, beat, pan=0.05, human=0.01)
                S.hit("vox", s.voice(m - 5 if m - 5 not in (66,) else m - 4, L * S.spb * 0.95, 0.3, "oh"),
                      rep, beat + 0.02, pan=-0.4, human=0.01)
    n = int(S.dur * SR)
    S.bus("crackle").add(s.crackle(n, 5, 0.05), 0)

    def post(x):
        return s.filt(x, "lowpass", 11000)
    S.render({
        "keys": (1.0, lambda x: s.reverb(s.chorus(x, 0.002, 0.4), 1.8, 0.25)),
        "bass": (0.9, None),
        "drums": (0.75, lambda x: s.reverb(s.filt(x, "lowpass", 9000), 0.9, 0.15)),
        "vox": (0.55, lambda x: s.reverb(x, 2.8, 0.45, 0.04)),
        "crackle": (0.6, None),
    }, post, -16, 72, dark=4)


# ======================================================================
# 2. Coastline Static — Marlow & the Saltwater — indie folk, 96 bpm
# ======================================================================

def coastline_static():
    S = Song("coastline-static", 96, 44)
    # (bass root, chord tones for picking)
    G, D, Em, C, Am = (43, [55, 59, 62, 67]), (42, [54, 57, 62, 66]), (40, [52, 55, 59, 64]), \
        (36, [52, 55, 60, 64]), (45, [57, 60, 64, 67])
    verse = [G, D, Em, C]
    chorus = [C, G, D, Em, C, G, D, D]
    S.section("Intro", 0, 4, 0.3)
    S.section("Verse", 4, 8, 0.55)
    S.section("Chorus", 12, 8, 0.9)
    S.section("Interlude", 20, 4, 0.5)
    S.section("Verse", 24, 8, 0.6)
    S.section("Chorus", 32, 8, 1.0)
    S.section("Outro", 40, 4, 0.3)

    def harmony(bar):
        if active(S, bar, [(12, 20), (32, 40)]):
            return chorus[(bar - 12) % 8]
        return verse[bar % 4]
    for bar in range(S.bars):
        root, tones = harmony(bar)
        # travis picking: alternating thumb, treble on offbeats
        thumb = [root + 12, tones[1] - 12 + 12, root + 12, tones[1]]
        for i, beat in enumerate((0, 1, 2, 3)):
            if bar >= 43 and beat > 0:
                continue
            S.hit("gtr1", s.guitar(thumb[i] if i % 2 else root + 12, 1.2 * S.spb, 0.8, 0.45), bar, beat, -0.35)
        for beat, idx in ((0.5, 2), (1.5, 3), (2.5, 1), (3, 2), (3.5, 3)):
            if bar >= 43:
                continue
            S.hit("gtr1", s.guitar(tones[idx] + 12, 0.9 * S.spb, 0.55, 0.6), bar, beat, -0.35)
        if active(S, bar, [(12, 24), (32, 42)]):
            arp = [tones[0] + 24, tones[2] + 12, tones[3] + 12, tones[1] + 24]
            for e in range(8):
                S.hit("gtr2", s.guitar(arp[e % 4], 0.6 * S.spb, 0.4, 0.75), bar, e * 0.5 + 0.25, 0.5)
        if active(S, bar, [(4, 42)]):
            for beat, note in ((0, root), (1.5, root + 7), (2, root + 7 if bar % 2 else root + 12), (3, root + 4)):
                S.hit("bass", s.upright(note, 0.9 * S.spb, 0.85), bar, beat)
        if active(S, bar, [(12, 20), (24, 40)]):
            S.accents["kick"] += [S.hit("perc", s.kick(0.6, 0.9, 6), bar, 0), S.hit("perc", s.kick(0.45, 0.9, 6), bar, 2)]
            S.accents["snare"] += [S.hit("perc", s.snare(0.3, 170, 0.4), bar, 1), S.hit("perc", s.snare(0.3, 170, 0.4), bar, 3)]
            if active(S, bar, [(12, 20), (32, 40)]):
                for e in range(8):
                    S.hit("perc", s.shaker(0.6 + 0.3 * (e % 2)), bar, e * 0.5, 0.4)
    # mandolin-ish lead melody in the choruses and interlude
    mel = [(0, 0.5, 76), (0.5, 0.5, 74), (1, 1, 71), (2, 0.5, 74), (2.5, 1.5, 76),
           (4, 0.5, 79), (4.5, 0.5, 78), (5, 1, 74), (6, 2, 71),
           (8, 0.5, 72), (8.5, 0.5, 71), (9, 1, 67), (10, 0.5, 71), (10.5, 1.5, 74),
           (12, 1, 71), (13, 1, 69), (14, 2, 67)]
    for start in (12, 16, 20, 32, 36):
        for beat, L, m in mel:
            for k in range(int(L * 4)):  # tremolo picking
                S.hit("lead", s.guitar(m, 0.3 * S.spb, 0.32 if k else 0.45, 0.85, False), start, beat + k * 0.25, 0.15)
    wind = s.filt(s.noise(int(S.dur * SR)), "bandpass", [300, 1600]) * 0.012
    wind *= 0.6 + 0.4 * np.sin(2 * np.pi * 0.07 * np.arange(len(wind)) / SR)
    S.bus("room").add(wind, 0)
    S.render({
        "gtr1": (1.0, lambda x: s.reverb(x, 1.4, 0.2)),
        "gtr2": (0.7, lambda x: s.reverb(x, 1.6, 0.3)),
        "lead": (0.65, lambda x: s.reverb(x, 2.0, 0.35)),
        "bass": (0.95, None),
        "perc": (0.7, lambda x: s.reverb(x, 1.2, 0.25)),
        "room": (1.0, None),
    }, None, -16, 80)


# ======================================================================
# 3. Cathedral Lights — Teodora Blue — dream pop, 104 bpm
# ======================================================================

def cathedral_lights():
    S = Song("cathedral-lights", 104, 44)
    prog = [(45, [57, 60, 64, 69]), (41, [57, 60, 65, 69]), (36, [55, 60, 64, 67]), (43, [55, 59, 62, 67])]
    S.section("Intro", 0, 8, 0.35)
    S.section("Verse", 8, 8, 0.6)
    S.section("Chorus", 16, 8, 0.95)
    S.section("Break", 24, 4, 0.4)
    S.section("Chorus", 28, 8, 1.0)
    S.section("Outro", 36, 8, 0.4)
    for bar in range(S.bars):
        root, v = prog[bar % 4]
        S.hit("pad", s.pad([m - 12 for m in v] + [v[0]], 4 * S.spb, 0.5, 1400 if bar < 16 else 2200, 0.6, 1.4), bar, 0, human=0)
        if bar < 42:
            pattern = [0, 1, 2, 3, 2, 1, 3, 2]
            bright = min(1.0, 0.15 + bar / 16)
            for e in range(16):
                m = v[pattern[e % 8]] + (12 if e % 4 == 3 else 0)
                S.hit("arp", s.arp_synth(m, 0.22 * S.spb, 0.55 + 0.2 * (e % 4 == 0), bright), bar, e * 0.25, human=0.0)
        if active(S, bar, [(8, 24), (28, 40)]):
            for e in range(8):
                S.hit("bass", s.synth_bass(root - 12 + (12 if e % 2 else 0), 0.45 * S.spb, 0.9), bar, e * 0.5, human=0.002)
        if active(S, bar, [(8, 24), (28, 40)]):
            chorus = active(S, bar, [(16, 24), (28, 36)])
            kicks = (0, 1, 2, 3) if chorus else (0, 2.5)
            for beat in kicks:
                S.accents["kick"].append(S.hit("drums", s.kick(0.95, 1.05, 9), bar, beat, human=0.001))
            for beat in (1, 3):
                S.accents["snare"].append(S.hit("snare", s.clap(0.8), bar, beat, human=0.001))
                S.hit("snare", s.snare(0.45, 210, 1.0, 12), bar, beat, human=0.001)
            for e in range(16):
                S.hit("drums", s.hat(0.18 + 0.2 * (e % 2), False), bar, e * 0.25, 0.3, human=0.001)
    choir = [(0, 2, 76), (2, 2, 72), (4, 3, 77), (7, 1, 76), (8, 2, 76), (10, 2, 79), (12, 4, 74)]
    for start in (16, 20, 28, 32):
        for beat, L, m in choir:
            S.hit("vox", s.voice(m, L * S.spb, 0.5, "ah"), start, beat, -0.2, human=0.01)
            S.hit("vox", s.voice(m - 4 if m in (76, 79, 74) else m - 3, L * S.spb, 0.32, "oo"), start, beat, 0.3, human=0.01)
    kicks = S.accents["kick"]
    S.render({
        "pad": (0.8, lambda x: s.duck(s.reverb(s.chorus(x, 0.004, 0.3), 3.5, 0.4), kicks, 0.35)),
        "arp": (0.65, lambda x: s.reverb(s.delay(x, S.spb * 0.75, 0.38, 0.3), 2.4, 0.3)),
        "bass": (0.85, lambda x: s.duck(x, kicks, 0.5, 0.15)),
        "drums": (0.75, None),
        "snare": (0.6, lambda x: s.reverb(x, 2.2, 0.45)),
        "vox": (0.6, lambda x: s.reverb(x, 4.0, 0.55, 0.05)),
    }, None, -15, 68)


# ======================================================================
# 4. Harmattan Sun — Yemi & the Daybreak — highlife, 116 bpm
# ======================================================================

def harmattan_sun():
    S = Song("harmattan-sun", 116, 56)
    C, F, G, Am = (36, [60, 64, 67]), (41, [60, 65, 69]), (43, [59, 62, 67]), (45, [60, 64, 69])
    prog_a = [C, F, G, C]
    prog_b = [Am, F, G, C]
    S.section("Intro", 0, 4, 0.35)
    S.section("Groove", 4, 8, 0.7)
    S.section("Horns", 12, 8, 0.95)
    S.section("Verse", 20, 8, 0.75)
    S.section("Horns", 28, 8, 1.0)
    S.section("Guitar", 36, 8, 0.9)
    S.section("Horns", 44, 8, 1.0)
    S.section("Outro", 52, 4, 0.4)
    bellpat = [0, 0.5, 1.0, 1.75, 2.25, 2.75, 3.25]
    for bar in range(S.bars):
        root, v = (prog_b if (bar // 4) % 2 else prog_a)[bar % 4]
        # guitar 1: circling 16th figure
        fig = [v[2] + 12, v[1] + 12, v[0] + 12, v[1] + 12, v[2] + 12, v[0] + 12, v[1] + 12, v[2] + 12]
        for e in range(16):
            if e % 8 in (3, 7) and bar < 4:
                continue
            S.hit("gtr1", s.eguitar(fig[e % 8], 0.3 * S.spb, 0.55 + 0.25 * (e % 4 == 0)), bar, e * 0.25, -0.45, 0.003)
        for beat in bellpat:
            S.hit("perc", s.bell(0.7, 1.0 if beat != 0 else 1.12), bar, beat, 0.5, human=0.002)
        if bar >= 4 and bar < 54:
            # guitar 2: syncopated thirds
            for beat in (0.75, 1.5, 2.75, 3.5):
                for m in (v[0] + 12, v[1] + 12):
                    S.hit("gtr2", s.eguitar(m, 0.4 * S.spb, 0.5), bar, beat, 0.45, 0.004)
            line = [(0, root), (0.75, root + 7), (1.5, root + 12), (2, root + 4 + 12 if root != 45 else root + 3 + 12),
                    (2.5, root + 7), (3.25, root + 9), (3.75, root + 11)]
            for beat, note in line:
                S.hit("bass", s.ebass(note, 0.45 * S.spb, 0.85), bar, beat)
            for beat in (0, 2):
                S.accents["kick"].append(S.hit("drums", s.kick(0.85, 1.1, 9), bar, beat))
            for beat in (1, 3):
                S.accents["snare"].append(S.hit("drums", s.rim(0.8), bar, beat))
            for e in range(16):
                S.hit("hats", s.shaker(0.9 + 0.6 * (e % 4 == 2)), bar, e * 0.25, -0.2, 0.003)
            for e in range(8):
                S.hit("hats", s.hat(0.5 if e % 2 else 0.3, e == 7), bar, e * 0.5, 0.3, 0.003)
            for beat, p, sl in ((0.5, 220, False), (1.5, 330, True), (2.25, 220, False), (2.5, 220, False), (3.5, 330, True)):
                S.hit("perc", s.conga(0.6, p, sl), bar, beat, 0.25)
    riff = [(0, 0.5, 72), (0.5, 0.5, 76), (1, 1, 79), (2.5, 0.5, 77), (3, 1, 76),
            (4, 0.5, 74), (4.5, 0.5, 72), (5, 1, 74), (6.5, 1.5, 72)]
    for start in (12, 14, 16, 18, 28, 30, 32, 34, 44, 46, 48, 50):
        for beat, L, m in riff:
            S.hit("horns", s.horn(m, L * S.spb * 0.9, 0.75), start, beat, -0.15)
            S.hit("horns", s.horn(m - 4 if m in (76, 72) else m - 3, L * S.spb * 0.9, 0.55), start, beat, 0.2)
    lead_scale = [72, 74, 76, 79, 81, 84]
    for bar in range(36, 44):
        for e in range(8):
            if S.rng.uniform() < 0.25:
                continue
            m = lead_scale[int(S.rng.integers(0, 6))]
            S.hit("lead", s.eguitar(m, 0.45 * S.spb, 0.7), bar, e * 0.5 + (0.25 if e % 3 == 2 else 0), 0.05)
    S.render({
        "gtr1": (0.85, lambda x: s.reverb(x, 1.0, 0.15)),
        "gtr2": (0.7, lambda x: s.reverb(x, 1.0, 0.15)),
        "lead": (0.75, lambda x: s.reverb(s.delay(x, S.spb * 0.5, 0.3, 0.2), 1.4, 0.2)),
        "bass": (1.0, None),
        "drums": (1.0, lambda x: s.reverb(x, 0.8, 0.12)),
        "perc": (1.0, lambda x: s.reverb(x, 1.0, 0.18)),
        "hats": (2.2, lambda x: s.reverb(x, 0.8, 0.15)),
        "horns": (0.65, lambda x: s.reverb(x, 1.6, 0.25)),
    }, None, -15, 84)


# ======================================================================
# 5. Slow Burn Avenue — Cass Ferro Trio — jazz trio, 110 bpm swing
# ======================================================================

def slow_burn_avenue():
    S = Song("slow-burn-avenue", 110, 64, swing=0.33)
    # chord = (root midi, quality); rootless voicings built below
    Q = {"maj7": [4, 7, 11, 14], "7": [4, 10, 14, 21 - 12], "m7": [3, 7, 10, 14], "7b9": [4, 10, 13, 19]}
    A = [[("F", "maj7")], [("D", "7")], [("G", "m7")], [("C", "7")],
         [("A", "m7"), ("D", "7")], [("G", "m7"), ("C", "7")], [("F", "maj7"), ("D", "7b9")], [("G", "m7"), ("C", "7")]]
    B = [[("A", "m7")], [("D", "7")], [("G", "m7")], [("C", "7")],
         [("A", "m7")], [("D", "7b9")], [("G", "m7")], [("C", "7b9")]]
    roots = {"F": 41, "D": 38, "G": 43, "C": 36, "A": 45}
    form = (A + A + B + A)
    intro = [[("G", "m7")], [("C", "7")], [("G", "m7")], [("C", "7b9")]]
    changes = intro + form + form[:16] + form[24:32] + [[("F", "maj7")]] * 4
    S.section("Intro", 0, 4, 0.3)
    S.section("Head", 4, 16, 0.6)
    S.section("Bridge", 20, 8, 0.7)
    S.section("Head", 28, 8, 0.65)
    S.section("Piano solo", 36, 16, 0.9)
    S.section("Head out", 52, 8, 0.6)
    S.section("Tag", 60, 4, 0.3)
    head = [  # (beat offset within 8 bars, length beats, midi)
        (0.5, 0.5, 69), (1, 1, 72), (2, 1.5, 74), (3.5, 2.5, 72),
        (8.5, 0.5, 69), (9, 0.5, 72), (9.5, 1, 74), (10.5, 1.5, 77), (12, 3, 76),
        (16, 1, 76), (17, 0.5, 74), (17.5, 0.5, 72), (18, 1, 69), (19, 2, 67),
        (24, 0.5, 65), (24.5, 0.5, 67), (25, 1, 69), (26, 1, 72), (27, 4, 69)]
    prev_bass = 41
    for bar in range(S.bars):
        chs = changes[bar]
        per = 4 / len(chs)
        for ci, (rn, q) in enumerate(chs):
            r = roots[rn]
            voicing = [r + 12 + iv for iv in Q[q]]
            while min(voicing) > 58:
                voicing = [m - 12 for m in voicing]
            while min(voicing) < 50:
                voicing = [m + 12 for m in voicing]
            comp = ((0, 0.9), (1.5, 0.45)) if per == 4 else ((0, 0.9),)
            if bar % 4 == 2 and per == 4:
                comp = ((0.5, 0.45), (2.5, 1.2))
            for beat, L in comp:
                for m in voicing:
                    S.hit("piano", s.piano(m, L * S.spb, 0.42), bar, ci * per + beat, -0.15, 0.008)
            # walking bass
            if bar >= 4:
                steps = [r, r + 7, r + (3 if "m" in q else 4) + 12 - 12, None][: int(per)]
                for k in range(int(per)):
                    if k == int(per) - 1:
                        nxt = changes[min(bar + (1 if ci == len(chs) - 1 else 0), S.bars - 1)][0 if ci == len(chs) - 1 else ci + 1][0]
                        target = roots[nxt]
                        note = target + (1 if S.rng.uniform() < 0.5 else -1)
                    else:
                        note = [r, r + 7, r + (3 if "m" in q else 4)][k % 3]
                    while note < 31:
                        note += 12
                    while note > 50:
                        note -= 12
                    S.hit("bass", s.upright(note, 0.95 * S.spb, 0.9), bar, ci * per + k)
                    prev_bass = note
        if bar >= 4 and bar < 62:
            for beat in (0, 1, 1.5, 2, 3, 3.5):
                S.hit("ride", s.ride(0.3 if beat % 1 else 0.42), bar, beat, 0.35, 0.004)
            for beat in (1, 3):
                S.accents["snare"].append(S.hit("drums", s.hat(0.35), bar, beat, 0.2))
                S.hit("drums", s.brush(0.6, 0.4), bar, beat, -0.1)
            S.accents["kick"].append(S.hit("drums", s.kick(0.35, 1.0, 10), bar, 0))
            if S.rng.uniform() < 0.3:
                S.hit("drums", s.snare(0.15, 230, 0.4), bar, 2.5, 0.1)
    for start in (4, 12, 28, 52):
        for beat, L, m in head:
            S.hit("piano", s.piano(m, L * S.spb, 0.75), start, beat, 0.1, 0.006)
            S.hit("piano", s.piano(m - 12, L * S.spb, 0.35), start, beat, 0.1, 0.006)
    # bridge melody
    for beat, L, m in [(0, 1, 76), (1, 1, 77), (2, 2, 79), (4, 1.5, 78), (5.5, 2.5, 74),
                       (8, 1, 74), (9, 1, 76), (10, 2, 77), (12, 4, 76),
                       (16, 1, 76), (17, 1, 77), (18, 2, 79), (20, 1, 81), (21, 2, 79), (24, 1, 77), (25, 3, 76)]:
        S.hit("piano", s.piano(m, L * S.spb, 0.75), 20, beat, 0.1, 0.006)
    # improvised solo: chord-tone 8ths with approach notes
    scale = [0, 2, 4, 5, 7, 9, 10]
    cur = 72
    for bar in range(36, 52):
        r = roots[changes[bar][0][0]]
        for e in range(8):
            if S.rng.uniform() < 0.18 and e % 2 == 1:
                continue
            step = int(S.rng.choice([-2, -1, 1, 1, 2, 3, -3]))
            pc = [(r + iv) % 12 for iv in scale]
            cur = max(64, min(86, cur + step))
            while cur % 12 not in pc:
                cur += 1 if step > 0 else -1
            vel = 0.6 + 0.2 * (e % 2 == 0)
            S.hit("piano", s.piano(cur, 0.55 * S.spb, vel), bar, e * 0.5, 0.1, 0.008)
    S.render({
        "piano": (1.0, lambda x: s.reverb(x, 1.6, 0.22)),
        "bass": (1.0, lambda x: s.reverb(x, 0.8, 0.08)),
        "drums": (0.7, lambda x: s.reverb(x, 1.2, 0.18)),
        "ride": (0.45, lambda x: s.reverb(s.filt(x, "lowpass", 9000), 1.2, 0.2)),
    }, lambda x: s.filt(x, "lowpass", 12000), -17, 88, dark=3)


# ======================================================================
# 6. Glass Horizon — Halden — ambient electronic, 86 bpm
# ======================================================================

def glass_horizon():
    S = Song("glass-horizon", 86, 44)
    prog = [(40, [56, 59, 63, 66]), (37, [56, 59, 63, 64]), (45, [56, 61, 64, 68]), (47, [54, 59, 64, 66])]
    S.section("Intro", 0, 8, 0.25)
    S.section("Rise", 8, 8, 0.55)
    S.section("Swell", 16, 8, 0.85)
    S.section("Clearing", 24, 4, 0.35)
    S.section("Swell", 28, 8, 1.0)
    S.section("Outro", 36, 8, 0.3)
    motif = [(0, 71), (0.75, 68), (1.5, 75), (2.5, 73), (3, 71)]
    for bar in range(S.bars):
        root, v = prog[bar % 4]
        S.hit("pad", s.pad(v + [v[1] + 12], 4.1 * S.spb, 0.55, 1100 + 900 * (bar >= 16), 1.8, 2.5), bar, 0, human=0)
        if bar >= 8 and bar < 42:
            for beat, m in motif:
                S.hit("bells", s.sine_bell(m + (12 if bar % 8 >= 4 else 0), 1.5 * S.spb, 0.6), bar, beat, 0.3 - 0.6 * (beat > 1.5), 0.004)
        if active(S, bar, [(16, 24), (28, 38)]):
            S.hit("bass", s.synth_bass(root - 12, 3.6 * S.spb, 0.75), bar, 0)
        if active(S, bar, [(8, 24), (28, 36)]):
            for beat in (0, 1.75, 2.5):
                S.accents["kick"].append(S.hit("drums", s.kick(0.7, 0.95, 7), bar, beat))
            for beat in (1, 3):
                S.accents["snare"].append(S.hit("drums", s.snare(0.4, 180, 0.6, 14), bar, beat))
            for e in range(8):
                S.hit("drums", s.shaker(0.4 + 0.3 * (e % 2)), bar, e * 0.5, 0.3)
    n = int(S.dur * SR)
    rain = s.filt(s.noise(n), "bandpass", [1500, 9000]) * 0.02
    drops = np.zeros(n)
    for p in S.rng.integers(0, n - 500, int(n / SR * 14)):
        L = 300
        drops[p:p + L] += np.sin(2 * np.pi * S.rng.uniform(2000, 4500) * np.arange(L) / SR) * np.exp(-np.arange(L) / 40) * S.rng.uniform(0.05, 0.2)
    S.bus("rain").add(rain + drops * 0.3, 0)
    kicks = S.accents["kick"]
    S.render({
        "pad": (0.85, lambda x: s.duck(s.reverb(s.chorus(x, 0.005, 0.2), 5.0, 0.5), kicks, 0.2)),
        "bells": (0.7, lambda x: s.reverb(s.delay(x, S.spb * 0.75, 0.45, 0.35), 4.0, 0.45)),
        "bass": (0.85, None),
        "drums": (0.6, lambda x: s.reverb(s.filt(x, "lowpass", 6000), 1.6, 0.25)),
        "rain": (0.8, lambda x: s.reverb(x, 1.0, 0.3)),
    }, lambda x: s.tape_wow(x), -16, 76, dark=3)


SONGS = {
    "paper-moons": paper_moons,
    "coastline-static": coastline_static,
    "cathedral-lights": cathedral_lights,
    "harmattan-sun": harmattan_sun,
    "slow-burn-avenue": slow_burn_avenue,
    "glass-horizon": glass_horizon,
}

if __name__ == "__main__":
    which = sys.argv[1:] or list(SONGS)
    for sid in which:
        SONGS[sid]()

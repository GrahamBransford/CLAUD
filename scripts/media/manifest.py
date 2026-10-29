"""
Collects durations, preview windows, highlight ranges, chapters and
transcripts from the generated media into src/data/media.json, which the
app reads. Paths are relative to the site root (public/).
"""
import json
import os
import subprocess

import art

ROOT, WORK, PUB = art.ROOT, art.WORK, art.PUB


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         capture_output=True, text=True).stdout.strip()
    return round(float(out), 2) if out else None


def main():
    m = {"songs": {}, "episodes": {}, "handhelds": {}}
    for s in art.CAT["songs"]:
        ev = json.load(open(f"{WORK}/audio/{s['id']}.events.json"))
        mp4 = f"{PUB}/singers/{s['id']}.mp4"
        m["songs"][s["id"]] = {
            "video": f"media/singers/{s['id']}.mp4",
            "poster": f"media/singers/{s['id']}.jpg",
            "duration": probe(mp4) or round(ev["duration"], 2),
            "previewEnd": ev["previewEnd"],
        }
    for e in art.CAT["episodes"]:
        meta = json.load(open(f"{WORK}/podcasts/{e['id']}.json"))
        h = meta["highlight"]
        m["episodes"][e["id"]] = {
            "speakers": {k: {"name": v["name"]} for k, v in meta["speakers"].items()},
            "full": {"video": f"media/speakers/{e['id']}.full.mp4", "poster": f"media/speakers/{e['id']}.full.jpg",
                     "duration": probe(f"{PUB}/speakers/{e['id']}.full.mp4") or meta["duration"]},
            "highlight": {"video": f"media/speakers/{e['id']}.highlight.mp4", "poster": f"media/speakers/{e['id']}.jpg",
                          "duration": probe(f"{PUB}/speakers/{e['id']}.highlight.mp4") or h["duration"],
                          "sourceStart": h["start"], "sourceEnd": h["end"]},
            "chapters": meta["chapters"],
            "cues": [{k: c[k] for k in ("start", "end", "speaker", "text")} for c in meta["cues"]],
            "highlightCues": [{k: c[k] for k in ("start", "end", "speaker", "text")} for c in meta["highlightCues"]],
        }
    for p in art.CAT["handhelds"]:
        if p["type"] == "video":
            m["handhelds"][p["id"]] = {"src": f"media/handhelds/{p['id']}.mp4", "poster": f"media/handhelds/{p['id']}.jpg",
                                       "duration": probe(f"{PUB}/handhelds/{p['id']}.mp4")}
        else:
            m["handhelds"][p["id"]] = {"src": f"media/handhelds/{p['id']}.jpg", "poster": f"media/handhelds/{p['id']}.jpg"}
    json.dump(m, open(f"{ROOT}/src/data/media.json", "w"), indent=1)
    print("manifest written")


if __name__ == "__main__":
    main()

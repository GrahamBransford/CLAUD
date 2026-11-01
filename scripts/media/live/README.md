# Live media: sources and recipe

Everything in `public/media/live` was cut from openly licensed sources with `encode.py` and `plan.json` (plus a few hand-tuned crops noted below). Full per-item credits live in `content/real/library.json` and in the app under Settings, Credits.

- **Artist footage:** Mixkit stock video (Mixkit Stock Video Free License), `https://assets.mixkit.co/videos/<id>/<id>-1080.mp4` (720 for 13019, 14106, 14756). The performers are real people filmed for stock; the artist names, bios and captions in CIRCA are invented for the demo.
- **Music:** Mixkit stock music (Mixkit Stock Music Free License), `https://assets.mixkit.co/music/<id>/<id>.mp3`: 695 "Pop 05" (Grigoriy Nuzhny), 659 "Romantic" (Francisco Alvear), 493 "Beautiful Dream" (Diego Nava), 400 "C.B.P.D" (Arulo), 1210 "Can't Get You Off My Mind" (Michael Ramir C.), 51 "Sports Highlights" (Ahjay Stelino).
- **Podcasts:** NASA Image and Video Library (`https://images.nasa.gov`), public domain; five-minute excerpts of the `~medium.mp4` renditions. NASA does not endorse CIRCA.
- **Hand-tuned:** `ic-kairo-booth` (a tighter crop of 13019), the four podcast avatars (`av-houston-we-have-a-podcast`, `av-rocket-ranch`, `av-down-to-earth`, `av-nasa-science-live`), and `av-juniper-lowe` (cx 0.68, size 0.5).

Songs are vertical 540×960 (footage looped under the whole track), Inner Circle moments vertical 540×960 with the artist's track underneath, episodes 640×360. Every file stays under 15 MB.

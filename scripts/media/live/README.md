# Live media: sources and recipe

Everything in `public/media/live` was cut from openly licensed sources with `encode.py`, `plan.json` and `plan2.json` (plus a few hand-tuned crops noted below). Full per-item credits live in `content/real/library.json` and in the app under Settings, Credits.

- **Artist footage:** Mixkit stock video (Mixkit Stock Video Free License), `https://assets.mixkit.co/videos/<id>/<id>-1080.mp4` (720 for 13019, 14106, 14756). The performers are real people filmed for stock; the artist names, bios and captions in CIRCA are invented for the demo.
- **Music:** Mixkit stock music (Mixkit Stock Music Free License), `https://assets.mixkit.co/music/<id>/<id>.mp3`: 695 "Pop 05" (Grigoriy Nuzhny), 659 "Romantic" (Francisco Alvear), 493 "Beautiful Dream" (Diego Nava), 400 "C.B.P.D" (Arulo), 1210 "Can't Get You Off My Mind" (Michael Ramir C.), 51 "Sports Highlights" (Ahjay Stelino), 39 "Latin Lovers" (Ahjay Stelino), 587 "Discover" and 614 "Silent Descent" and 580 "Sun and His Daughter" (Eugenio Mininni), 371 "Cat Walk" (Arulo), 989 "Dirty Thinkin'" and 872 "Gimme that Groove!" (Michael Ramir C.), 657 "Wedding 01" (Francisco Alvear).
- **Podcasts:** NASA Image and Video Library (`https://images.nasa.gov`), public domain; five-minute excerpts of the `~medium.mp4` renditions. NASA does not endorse CIRCA.
- **Hand-tuned:** `ic-kairo-booth` (a tighter crop of 13019), the four podcast avatars (`av-houston-we-have-a-podcast`, `av-rocket-ranch`, `av-down-to-earth`, `av-nasa-science-live`), and `av-juniper-lowe` (cx 0.68, size 0.5).

Songs were re-encoded at CRF 33 / 400 kb/s (looped footage compresses well) to keep the whole app under the preview's 256 MB limit. Songs are vertical 540×960 (footage looped under the whole track), Inner Circle moments vertical 540×960 with the artist's track underneath, episodes 640×360. Every file stays under 15 MB.

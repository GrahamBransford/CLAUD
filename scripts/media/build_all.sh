#!/usr/bin/env bash
# Regenerates every demo media asset from scratch (~30–40 min on 4 cores).
# Requirements: python3 with numpy, scipy, pillow, piper-tts; ffmpeg; and the
# fonts (Fraunces, Instrument Sans, Caveat from github.com/google/fonts) in
# $WORK/fonts and the Piper "en-us-libritts-high" voice in $WORK/voices.
set -euo pipefail
cd "$(dirname "$0")"
export WORK="${WORK:-/tmp/claude-0/work}"

python3 art.py
python3 songs.py
python3 videos.py
python3 podcasts.py
for e in in-defense-of-boredom the-bassline what-an-old-radio-knows who-gets-paid; do
  python3 podcast_video.py "$e" &
done
wait
python3 handhelds.py
./normalize.sh
python3 manifest.py

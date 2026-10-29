#!/usr/bin/env bash
# Post-processing for spoken and handheld media:
#  - loudness-normalise to -16 LUFS (podcast norm) so switching stations
#    never means reaching for the volume
#  - Handhelds: scale to 432x768 and denoise the rendered grain (the app adds
#    its own film grain overlay), which cuts file size by ~5x
# Run once on freshly rendered files.
set -euo pipefail
cd "$(dirname "$0")/../../public/media"
LOUD="loudnorm=I=-16:TP=-1.5:LRA=11"
for f in speakers/*.mp4; do
  ffmpeg -y -loglevel error -i "$f" -c:v copy -af "$LOUD" -ar 44100 -c:a aac -b:a 112k -ac 1 -movflags +faststart "$f.tmp.mp4"
  mv "$f.tmp.mp4" "$f"
done
for f in handhelds/*.mp4; do
  ffmpeg -y -loglevel error -i "$f" -vf "scale=432:768:flags=bicubic,hqdn3d=5:5:10:10" -c:v libx264 -preset slow -crf 30 \
    -pix_fmt yuv420p -g 48 -af "$LOUD" -ar 44100 -c:a aac -b:a 112k -ac 1 -movflags +faststart "$f.tmp.mp4"
  mv "$f.tmp.mp4" "$f"
done

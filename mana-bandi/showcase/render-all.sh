#!/usr/bin/env bash
# Renders every showcase video into ./out, then joins the launch film.
# Needs the prototype on :8090 and the owner-portal static build on :8091 (see README.md).
set -euo pipefail
cd "$(dirname "$0")"
node record.cjs customer wide
node record.cjs captain  wide
node record.cjs owner    wide
node record.cjs customer tall
node record.cjs captain  tall
# Launch film = customer + captain + owner (16:9), each already has its own title and end card.
printf "file 'mana-bandi-customer-16x9.mp4'\nfile 'mana-bandi-captain-16x9.mp4'\nfile 'mana-bandi-owner-16x9.mp4'\n" > out/launch-list.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i out/launch-list.txt -c copy out/mana-bandi-launch-film-16x9.mp4
ls -lh out/*.mp4

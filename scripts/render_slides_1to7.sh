#!/bin/bash
# Render each slide HTML to a 1280x720 screenshot in /tmp/render for visual QA.
set -u
mkdir -p /tmp/render
OUT=/tmp/render
agent-browser set viewport 1280 720 || exit 1
for n in 01 02 03 04 05 06 07; do
  f="/home/z/my-project/download/slides/slide_${n}.html"
  agent-browser open "file://$f" >/dev/null 2>&1
  agent-browser wait --timeout 8000 >/dev/null 2>&1
  sleep 1.2
  agent-browser screenshot "$OUT/slide_${n}.png" >/dev/null 2>&1
  echo "slide_${n}: $(ls -la $OUT/slide_${n}.png 2>/dev/null | awk '{print $5}') bytes"
done

#!/bin/bash
# Assemble the ABN Homes demo video: title cards + recorded walkthrough +
# TTS narration placed at scene-change timestamps.
set -e
cd /home/z/my-project/assets/video
RAW="2c8b6cd7fc62885708770bed20b75ebd.webm"

# --- narration segments: (start_seconds_in_final_video, text) -------------
# Final video = 5s opening card + raw (140.56s) + 6s closing card.
declare -a SEGS=(
  "5.0|Welcome to A B N Homes. This short tour shows the whole platform, from the public website to the operations behind it."
  "22.8|The residences marketplace. Live availability, honest pricing, filters and reviews for every unit."
  "41.4|Each stay page shows photos, amenities, house rules and a live quote. Guests book directly, with no platform fees."
  "49.4|Booking holds the dates instantly. One form, and the system quotes, checks availability and reserves."
  "62.2|Payment runs through a simulated mobile money checkout. Money hits the double entry ledger the moment it settles."
  "71.1|Payment auto confirms the booking, fires receipts and nudges the team. Nobody touches a spreadsheet."
  "76.0|The staff console. Bookings, calendar, money, housekeeping and reports. Twenty two pages of operations in one place."
  "116.9|Every booking carries its full ledger trail, audit history and guest communication timeline."
  "142.5|Owners and tenants get their own self service portals, with statements, leases, trips and requests."
  "148.5|A B N Homes. Built, tested and live. Thanks for watching."
)

# --- 1. narration audio ---------------------------------------------------
i=0
for seg in "${SEGS[@]}"; do
  text="${seg#*|}"
  n=$(printf "%02d" $i)
  z-ai tts -i "$text" -o "nar_${n}.wav" --voice jam --format wav >/dev/null 2>&1
  echo "nar_${n}: $(ffprobe -v quiet -show_entries format=duration -of csv=p=0 nar_${n}.wav)s"
  i=$((i+1))
done

# --- 2. title card clips --------------------------------------------------
ffmpeg -y -loop 1 -i card_open.png -t 5 -r 24 -vf scale=1280:720 \
  -c:v libx264 -pix_fmt yuv420p -an card_open.mp4 >/dev/null 2>&1
ffmpeg -y -loop 1 -i card_close.png -t 6 -r 24 -vf scale=1280:720 \
  -c:v libx264 -pix_fmt yuv420p -an card_close.mp4 >/dev/null 2>&1

# --- 3. concat video (cards + walkthrough) --------------------------------
ffmpeg -y -i card_open.mp4 -i "$RAW" -i card_close.mp4 -filter_complex \
  "[0:v]fps=24,format=yuv420p[v0];[1:v]fps=24,format=yuv420p,scale=1280:720[v1];[2:v]fps=24,format=yuv420p[v2];[v0][v1][v2]concat=n=3:v=1:a=0[outv]" \
  -map "[outv]" -c:v libx264 -preset medium -crf 22 video_only.mp4 >/dev/null 2>&1

# --- 4. narration track: silence base + delayed segments ------------------
TOTAL=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 video_only.mp4)
INPUTS="-i video_only.mp4"
for f in nar_*.wav; do INPUTS+=" -i $f"; done
FILTER="anullsrc=r=24000:cl=mono,atrim=0:${TOTAL},asetpts=PTS-STARTPTS[base];"
MIX="[base]"
i=0
for seg in "${SEGS[@]}"; do
  at="${seg%%|*}"
  ms=$(python3 -c "print(int(${at}*1000))")
  idx=$((i + 1))
  FILTER+="[${idx}:a]aresample=24000,adelay=${ms}|${ms}[a${i}];"
  MIX+="[a${i}]"
  i=$((i + 1))
done
FILTER+="${MIX}amix=inputs=$((i + 1)):normalize=0,apad=whole_dur=${TOTAL}[aout]"
ffmpeg -y $INPUTS -filter_complex "$FILTER" -map "[aout]" -c:a aac narration.m4a >/dev/null 2>&1

# --- 5. mux ---------------------------------------------------------------
ffmpeg -y -i video_only.mp4 -i narration.m4a -c:v copy -c:a aac \
  -movflags +faststart "/home/z/my-project/download/ABN-Homes-Demo.mp4" >/dev/null 2>&1

echo "=== final: $(ffprobe -v quiet -show_entries format=duration -of csv=p=0 /home/z/my-project/download/ABN-Homes-Demo.mp4)s"
ls -lh /home/z/my-project/download/ABN-Homes-Demo.mp4

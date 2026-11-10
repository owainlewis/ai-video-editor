#!/bin/zsh
# The facts /upload-youtube needs about a finished video: picture, length, loudness, and whether the encoder starved the ending.
set -eu
f="$1"
[[ -f "$f" ]] || { echo "no such file: $f"; exit 1; }
echo "file: $f ($(( $(stat -f %z "$f") / 1000000 )) MB)"
ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate:format=duration -of default=nw=1 "$f" | paste -sd' ' -
ffmpeg -nostdin -i "$f" -vn -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1 | grep -E '"input_i"|"input_tp"' | tr -d '\t,"' | paste -sd' ' -
d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
echo "frame sizes in the last 2 s (KB):"
ffprobe -v error -select_streams v -read_intervals "$(echo "$d - 2" | bc)%" -show_entries frame=pkt_size -of csv=p=0 "$f" | awk '{printf "%d ", $1/1000} END {print ""}'

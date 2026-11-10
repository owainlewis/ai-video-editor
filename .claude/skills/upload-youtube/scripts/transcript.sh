#!/bin/zsh
# A readable transcript of a finished video: Whisper (the model and vocabulary Studio's ingest uses),
# then plain paragraphs, a new one at each pause of a second or more.
set -eu
video="$1"; out="$2"
tmp=$(mktemp -d)
ffmpeg -nostdin -v error -i "$video" -vn -ac 1 -ar 16000 "$tmp/audio.wav"
uvx --from mlx-whisper mlx_whisper "$tmp/audio.wav" --model mlx-community/whisper-large-v3-turbo --language en \
  --output-format json --output-dir "$tmp" \
  --initial-prompt "Claude Code, Codex, Claude, Anthropic, OpenAI, GitHub, MCP, LLM, AI agents, Cursor, Gemini." >/dev/null
python3 - "$tmp/audio.json" "$out" <<'E'
import json, re, sys
segs = json.loads(re.sub(r'\bNaN\b', 'null', open(sys.argv[1]).read()))['segments']
paras, cur, end = [], [], None
for s in segs:
    t = s['text'].strip()
    if not t: continue
    if cur and (s['start'] - end >= 1.0 or len(' '.join(cur)) > 600) and cur[-1][-1:] in '.?!':
        paras.append(' '.join(cur)); cur = []
    cur.append(t); end = s['end']
if cur: paras.append(' '.join(cur))
open(sys.argv[2], 'w').write('\n\n'.join(paras) + '\n')
print(f"{len(paras)} paragraphs, {sum(len(p) for p in paras)} characters -> {sys.argv[2]}")
E
rm -rf "$tmp"

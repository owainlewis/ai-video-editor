# /// script
# dependencies = ["mlx-whisper"]
# ///
# Transcribe each wav with word times; writes <name>.json next to each. The model loads once.
import json, sys
import mlx_whisper

for path in sys.argv[1:]:
    result = mlx_whisper.transcribe(
        path,
        path_or_hf_repo="mlx-community/whisper-large-v3-turbo",
        language="en",
        word_timestamps=True,
        condition_on_previous_text=False,
    )
    words = [
        {"word": w["word"], "start": w["start"], "end": w["end"]}
        for s in result["segments"]
        for w in s.get("words", [])
    ]
    with open(path[:-4] + ".json", "w") as f:
        json.dump({"words": words}, f)
    print(path, len(words), file=sys.stderr)

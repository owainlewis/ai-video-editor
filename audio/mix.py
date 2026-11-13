"""Mix a reel's audio: the speaker, a music bed ducked under speech, and sound effects.

    python -m audio.mix projects/<slug> [build/audio.export.json] [build/preview/mix.wav]

Reads build/audio.json (written by `reel validate`) and source/voice.wav (or the
cut's voice that audio.json names),
writes build/mix.wav at -14 LUFS integrated and -1 dBTP, the level the
platforms normalise to. Sound files come from sounds/<kind>/ and music/<mood>/;
anything missing is synthesised.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

from . import sfx
from .dsp import SR
from .library import SoundLibrary, decode, music_bed, music_files

ROOT = Path(__file__).resolve().parent.parent


def library_root() -> Path:
    """Where sounds/ and music/ live: library/ in this repo (git-ignored). A git worktree has an
    empty copy, so it uses the main checkout's. STUDIO_LIBRARY overrides both."""
    import os

    if os.environ.get("STUDIO_LIBRARY"):
        return Path(os.environ["STUDIO_LIBRARY"]).expanduser()
    common = subprocess.run(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    main = Path(common).parent if common else ROOT
    has_audio = lambda root: any(p.is_file() and not p.name.startswith(".") for p in (root / "library" / "sounds").rglob("*"))
    return (main if not has_audio(ROOT) and has_audio(main) else ROOT) / "library"
TARGET_LUFS = -14.0
TRUE_PEAK = -1.5  # headroom for AAC encoding, which adds about 0.5 dB

# The voice arrives finished, from Auphonic (media/auphonic.ts) or Final Cut. It is never
# filtered, EQ'd or compressed here; only one linear gain reaches the platform loudness target.


def ffmpeg(args: list[str]) -> str:
    proc = subprocess.run(["ffmpeg", "-hide_banner", "-nostdin", "-y", *args], capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed:\n{proc.stderr[-3000:]}")
    return proc.stderr


def loudness(path: Path) -> dict:
    out = ffmpeg(["-i", str(path), "-af", f"loudnorm=I={TARGET_LUFS}:TP={TRUE_PEAK}:LRA=11:print_format=json", "-f", "null", "-"])
    return json.loads(out[out.rindex("{") : out.rindex("}") + 1])


def duck_graph(gain: float, music_db: float) -> str:
    return (
        f"[0:a]volume={gain}dB,asplit=2[v][key];"
        f"[1:a]volume={music_db}dB[m];"
        "[m][key]sidechaincompress=threshold=0.05:ratio=3:attack=40:release=900:makeup=1[duck]"
    )


def main(project: Path, config: str = "build/audio.json", out_path: str = "build/mix.wav") -> None:
    cfg = json.loads((project / config).read_text())
    seconds = float(cfg["duration"])
    cache = ROOT / ".cache/audio"
    # The editor's preview mix (media/previewmix.ts) writes elsewhere and works in its own folder,
    # so it never touches an export's files.
    work = project / ("build/audio" if out_path == "build/mix.wav" else "build/audio-preview")
    work.mkdir(parents=True, exist_ok=True)
    n = int(seconds * SR)
    gain = float(cfg.get("voiceGain", 0))

    def fit(x: np.ndarray) -> np.ndarray:
        x = x[:n]
        return np.concatenate([x, np.zeros((n - len(x), 2), dtype=np.float32)]) if len(x) < n else x

    # A project with a cut mixes the cut's voice (media/cutrender.ts), not the first clip's.
    voice = fit(decode(project / cfg.get("voice", "source/voice.wav"), cache))
    sf.write(work / "voice.wav", voice, SR, subtype="FLOAT")

    lib = library_root()
    m = cfg.get("music")
    tracks = ([lib / "music" / m["track"]] if m.get("track") else music_files(lib / "music", m.get("mood", "focus"))) if m else []
    if m and tracks:
        pick = tracks[sum(map(ord, project.name)) % len(tracks)]
        bed = music_bed(pick, seconds, cache, start=float(m.get("start", 0)))
        print(f"  music: {pick.name}")
        sf.write(work / "music.wav", fit(bed), SR, subtype="FLOAT")
        music_db = float(m.get("level", -20))
        if m.get("under") is not None:
            # Set the bed relative to this take's voice, as heard: after the duck, which takes about 8 dB
            # off a reel, where the voice hardly stops. The duck follows the voice, so one correction lands it.
            voice_i = float(loudness(work / "voice.wav")["input_i"]) + float(cfg.get("voiceGain", 0))
            music_db = voice_i - float(m["under"]) - float(loudness(work / "music.wav")["input_i"])
            ducked = work / "ducked.wav"
            ffmpeg(["-i", str(work / "voice.wav"), "-i", str(work / "music.wav"), "-filter_complex", duck_graph(gain, music_db) + ";[v]anullsink", "-map", "[duck]", "-c:a", "pcm_f32le", str(ducked)])
            music_db += voice_i - float(m["under"]) - float(loudness(ducked)["input_i"])
            print(f"  music: {m['under']} LU under the voice as heard ({music_db:+.1f} dB)")
    else:
        # A synthesised bed always sounded cheap; no music beats bad music.
        if m:
            print(f"  music: none (no tracks in {lib / 'music'}; add some to get a bed)")
        sf.write(work / "music.wav", np.zeros((n, 2), dtype=np.float32), SR, subtype="FLOAT")
        music_db = -90.0

    library = SoundLibrary(lib / "sounds", cache)
    print(f"  sounds: {library.summary()}")
    effects = sfx.render(cfg.get("sfx", []), seconds, 220.0, library, youtube=cfg.get("canvas") == "youtube")
    sf.write(work / "sfx.wav", fit(effects * 0.5), SR, subtype="FLOAT")

    # Reels: effects 6 dB louder than YouTube's (Owain, 2026-11-13: "quite quiet"); a placed sound
    # now peaks about 10 dB under the voice instead of 16.
    fx_db = -7.0 if cfg.get("canvas") == "youtube" else -1.0
    graph = (
        duck_graph(gain, music_db) + ";"
        f"[2:a]volume={fx_db}dB[fx];"
        "[v][duck][fx]amix=inputs=3:normalize=0,alimiter=limit=0.89:attack=3:release=60[mix]"
    )
    pre = work / "premaster.wav"
    ffmpeg(["-i", str(work / "voice.wav"), "-i", str(work / "music.wav"), "-i", str(work / "sfx.wav"),
            "-filter_complex", graph, "-map", "[mix]", "-c:a", "pcm_f32le", str(pre)])

    # Two-pass loudness normalisation for an exact integrated target.
    s = loudness(pre)
    norm = (
        f"loudnorm=I={TARGET_LUFS}:TP={TRUE_PEAK}:LRA=11:measured_I={s['input_i']}:measured_TP={s['input_tp']}:"
        f"measured_LRA={s['input_lra']}:measured_thresh={s['input_thresh']}:offset={s['target_offset']}:linear=true"
    )
    out = project / out_path
    out.parent.mkdir(parents=True, exist_ok=True)
    ffmpeg(["-i", str(pre), "-af", norm, "-ar", str(SR), "-c:a", "pcm_s24le", str(out)])
    final = loudness(out)
    print(f"  mix: {out.relative_to(project)} at {float(final['input_i']):.1f} LUFS, {float(final['input_tp']):.1f} dBTP")


if __name__ == "__main__":
    # An export of a cut passes its own settings (build/audio.export.json), which the editor never rewrites.
    main(Path(sys.argv[1]).resolve(), *sys.argv[2:4])

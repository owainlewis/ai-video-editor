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
import math
import shutil
import subprocess
import sys
import tempfile
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


_LOUDNESS_NUMERIC_KEYS = frozenset({
    "input_i",
    "input_tp",
    "input_lra",
    "input_thresh",
    "output_i",
    "output_tp",
    "output_lra",
    "output_thresh",
    "target_offset",
})


def _finite_float(val: object) -> float | None:
    if val is None:
        return None
    try:
        f = float(val)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return f if math.isfinite(f) else None


def _fmt_db(val: object) -> str:
    f = _finite_float(val)
    return f"{f:.1f}" if f is not None else "-inf"


def loudness(path: Path) -> dict:
    out = ffmpeg(["-i", str(path), "-af", f"loudnorm=I={TARGET_LUFS}:TP={TRUE_PEAK}:LRA=11:print_format=json", "-f", "null", "-"])
    start = out.rfind("{")
    end = out.rfind("}")
    if start == -1 or end <= start:
        return {}
    try:
        raw = json.loads(out[start : end + 1])
    except json.JSONDecodeError:
        return {}
    return {k: (_finite_float(v) if k in _LOUDNESS_NUMERIC_KEYS else v) for k, v in raw.items()}


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
    build_dir = project / "build"
    build_dir.mkdir(parents=True, exist_ok=True)
    # Each mix run gets its own temporary working directory so concurrent runs never collide,
    # and intermediates are always cleaned up on exit.
    work = Path(tempfile.mkdtemp(prefix="audio-work-", dir=build_dir))
    try:
        n = max(0, int(seconds * SR))
        gain = float(cfg.get("voiceGain", 0))
        mixed = bool(cfg.get("mixed"))

        def fit(x: np.ndarray) -> np.ndarray:
            x = x[:n]
            return np.concatenate([x, np.zeros((n - len(x), 2), dtype=np.float32)]) if len(x) < n else x

        # A project with a cut mixes the cut's voice (media/cutrender.ts), not the first clip's.
        voice = fit(decode(project / cfg.get("voice", "source/voice.wav"), cache))
        # The version without the call to action: the voice stops where the call to action would start,
        # in the pause before it, with a short fade so it never clicks.
        if cfg.get("voiceEnd") is not None:
            cut = max(0, min(int(float(cfg["voiceEnd"]) * SR), len(voice)))
            ramp = int(0.02 * SR)
            # A faint floor (about -100 dB), not digital silence: on a key of exact zeros the ducking
            # compressor outputs silence, which cut the music dead instead of letting it fade (2026-11-14).
            voice[cut:] = np.random.default_rng(0).normal(0, 1e-5, voice[cut:].shape)
            fade_len = min(ramp, cut)
            if fade_len > 0:
                voice[cut - fade_len : cut] *= np.linspace(1, 0, fade_len)[:, None]
        sf.write(work / "voice.wav", voice, SR, subtype="FLOAT")

        lib = library_root()
        m = cfg.get("music")
        tracks: list[Path] = []
        if m:
            if m.get("track"):
                track_path = lib / "music" / m["track"]
                if not track_path.is_file():
                    raise FileNotFoundError(f"music track not found: {track_path}")
                tracks = [track_path]
            else:
                tracks = music_files(lib / "music", m.get("mood", "focus"))
        if m and tracks:
            pick = tracks[sum(map(ord, project.name)) % len(tracks)]
            bed = music_bed(pick, seconds, cache, start=float(m.get("start", 0)))
            print(f"  music: {pick.name}")
            sf.write(work / "music.wav", fit(bed), SR, subtype="FLOAT")
            music_db = float(m.get("level", -20))
            if m.get("under") is not None:
                # Set the bed relative to this take's voice, as heard: after the duck, which takes about 8 dB
                # off a reel, where the voice hardly stops. The duck follows the voice, so one correction lands it.
                voice_i = _finite_float(loudness(work / "voice.wav").get("input_i"))
                music_i = _finite_float(loudness(work / "music.wav").get("input_i"))
                if voice_i is not None and music_i is not None:
                    voice_level = voice_i + gain
                    under = float(m["under"])
                    music_db = voice_level - under - music_i
                    ducked = work / "ducked.wav"
                    ffmpeg(["-i", str(work / "voice.wav"), "-i", str(work / "music.wav"), "-filter_complex", duck_graph(gain, music_db) + ";[v]anullsink", "-map", "[duck]", "-c:a", "pcm_f32le", str(ducked)])
                    ducked_i = _finite_float(loudness(ducked).get("input_i"))
                    if ducked_i is not None:
                        music_db += voice_level - under - ducked_i
                    print(f"  music: {m['under']} LU under the voice as heard ({music_db:+.1f} dB)")
                else:
                    print(f"  music: silent stem, keeping {music_db:+.1f} dB")
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
            f"[v][duck][fx]amix=inputs=3:normalize=0,alimiter=limit={0.99 if mixed else 0.89}:attack=3:release=60{':level=0' if mixed else ''}[mix]"
        )
        pre = work / "premaster.wav"
        ffmpeg(["-i", str(work / "voice.wav"), "-i", str(work / "music.wav"), "-i", str(work / "sfx.wav"),
                "-filter_complex", graph, "-map", "[mix]", "-c:a", "pcm_f32le", str(pre)])

        out = project / out_path
        out.parent.mkdir(parents=True, exist_ok=True)
        rel_out = out.relative_to(project) if out.is_relative_to(project) else out
        if mixed:
            # Owain's own mix goes out at his level: the effects sit on it, nothing is normalised.
            ffmpeg(["-i", str(pre), "-ar", str(SR), "-c:a", "pcm_s24le", str(out)])
            final = loudness(out)
            print(f"  mix: {rel_out} at {_fmt_db(final.get('input_i'))} LUFS (his level), {_fmt_db(final.get('input_tp'))} dBTP")
            return

        # Two-pass loudness normalisation for an exact integrated target.
        s = loudness(pre)
        measured = {k: _finite_float(s.get(k)) for k in ("input_i", "input_tp", "input_lra", "input_thresh", "target_offset")}
        if all(v is not None for v in measured.values()):
            norm = (
                f"loudnorm=I={TARGET_LUFS}:TP={TRUE_PEAK}:LRA=11:measured_I={measured['input_i']}:measured_TP={measured['input_tp']}:"
                f"measured_LRA={measured['input_lra']}:measured_thresh={measured['input_thresh']}:offset={measured['target_offset']}:linear=true"
            )
            ffmpeg(["-i", str(pre), "-af", norm, "-ar", str(SR), "-c:a", "pcm_s24le", str(out)])
        else:
            ffmpeg(["-i", str(pre), "-ar", str(SR), "-c:a", "pcm_s24le", str(out)])
        final = loudness(out)
        print(f"  mix: {rel_out} at {_fmt_db(final.get('input_i'))} LUFS, {_fmt_db(final.get('input_tp'))} dBTP")
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    # An export of a cut passes its own settings (build/audio.export.json), which the editor never rewrites.
    main(Path(sys.argv[1]).resolve(), *sys.argv[2:4])

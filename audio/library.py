"""Your own sound effects and music.

Drop audio files into folders and the pipeline uses them instead of the
synthesised defaults:

    sounds/whoosh/*.wav   scene changes
    sounds/pop/*.wav      list items, flow steps, bars appearing
    sounds/impact/*.wav   stats landing, the opening hit
    sounds/riser/*.wav    the build into a stat
    sounds/thud/*.wav     the "versus" moment in comparisons
    sounds/key/*.wav      typing in code and terminal scenes
    sounds/blip/*.wav     code highlights, terminal output
    sounds/chime/*.wav    the call to action
    music/*.mp3           music beds; music/<mood>/ narrows the choice

Any format ffmpeg reads works. A kind with no files falls back to synthesis.
"""

from __future__ import annotations

import hashlib
import os
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

from .dsp import SR, fade, to_rms

AUDIO = {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aif", ".aiff", ".opus"}
KINDS = ("whoosh", "pop", "impact", "riser", "thud", "key", "blip", "chime")


def _files(folder: Path) -> list[Path]:
    if not folder.is_dir():
        return []
    return sorted(p for p in folder.iterdir() if p.suffix.lower() in AUDIO and not p.name.startswith("."))


def decode(path: Path, cache: Path) -> np.ndarray:
    """Stereo float32 at the pipeline rate, cached by path and modification time."""
    key = hashlib.sha256(f"{path.resolve()}:{path.stat().st_mtime_ns}".encode()).hexdigest()[:20]
    out = cache / f"{key}.wav"
    if not out.exists():
        cache.mkdir(parents=True, exist_ok=True)
        fd, tmp_name = tempfile.mkstemp(prefix=f".{key}-", suffix=".wav", dir=cache)
        os.close(fd)
        tmp = Path(tmp_name)
        try:
            subprocess.run(
                ["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-i", str(path), "-ac", "2", "-ar", str(SR), "-c:a", "pcm_f32le", str(tmp)],
                check=True,
            )
            os.replace(tmp, out)
        except BaseException:
            tmp.unlink(missing_ok=True)
            raise
    audio, _ = sf.read(out, dtype="float32", always_2d=True)
    return audio


class SoundLibrary:
    def __init__(self, root: Path | None, cache: Path):
        self.cache = cache
        self.files = {kind: _files(root / kind) if root else [] for kind in KINDS}
        self._decoded: dict[Path, np.ndarray] = {}

    def has(self, kind: str) -> bool:
        return bool(self.files.get(kind))

    def summary(self) -> str:
        found = {k: len(v) for k, v in self.files.items() if v}
        return ", ".join(f"{k} {n}" for k, n in found.items()) if found else "none, using synthesised sounds"

    def pick(self, kind: str, index: int) -> np.ndarray:
        """A sample for this event, varied by index but the same on every run."""
        files = self.files[kind]
        path = files[index % len(files)]
        if path not in self._decoded:
            audio = decode(path, self.cache)
            peak = float(np.max(np.abs(audio))) if audio.size > 0 else 0.0
            self._decoded[path] = audio * (0.7 / (peak or 1.0))
        return self._decoded[path]


def music_files(root: Path | None, mood: str) -> list[Path]:
    if not root:
        return []
    return _files(root / mood) or _files(root)


def music_bed(path: Path, seconds: float, cache: Path, crossfade: float = 2.0, start: float = 0.0) -> np.ndarray:
    """Loop a track with a crossfade until it covers `seconds`, then fade out. `start` skips into it."""
    n = max(0, int(seconds * SR))
    if n == 0:
        return np.zeros((0, 2), dtype=np.float32)
    track = decode(path, cache)[max(0, int(start * SR)) :]
    if len(track) == 0:
        return np.zeros((n, 2), dtype=np.float32)
    xf = min(max(0, int(crossfade * SR)), (len(track) - 1) // 2)
    if len(track) >= n:
        out = track[:n]
    elif xf == 0:
        reps = (n + len(track) - 1) // len(track)
        out = np.tile(track, (reps, 1))[:n]
    else:
        ramp = np.linspace(0, 1, xf)[:, None]
        joint = track[-xf:] * (1 - ramp) + track[:xf] * ramp
        step = len(track) - xf
        extra = (n - len(track) + step - 1) // step
        parts = [track[:-xf]]
        for _ in range(extra - 1):
            parts.append(joint)
            parts.append(track[xf:-xf])
        parts.append(joint)
        parts.append(track[xf:])
        out = np.concatenate(parts)[:n]
    return to_rms(fade(out, 0.3, 1.8), -20.0).astype(np.float32)

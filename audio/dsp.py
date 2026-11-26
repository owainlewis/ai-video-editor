"""Small DSP toolkit shared by the music and sound effect generators."""

from __future__ import annotations

from functools import lru_cache

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
_MIN_HZ = 1.0
_MAX_HZ = SR / 2 - 100


def t_axis(seconds: float) -> np.ndarray:
    return np.arange(int(seconds * SR)) / SR


def midi_hz(note: float) -> float:
    return 440.0 * 2 ** ((note - 69) / 12)


def lowpass(x: np.ndarray, hz: float, order: int = 2) -> np.ndarray:
    if x.size == 0:
        return x.copy()
    hz = min(max(hz, _MIN_HZ), _MAX_HZ)
    return sosfilt(butter(order, hz, "low", fs=SR, output="sos"), x, axis=0)


def highpass(x: np.ndarray, hz: float, order: int = 2) -> np.ndarray:
    if x.size == 0:
        return x.copy()
    hz = min(max(hz, _MIN_HZ), _MAX_HZ)
    return sosfilt(butter(order, hz, "high", fs=SR, output="sos"), x, axis=0)


def bandpass(x: np.ndarray, lo: float, hi: float, order: int = 2) -> np.ndarray:
    if x.size == 0:
        return x.copy()
    lo = min(max(lo, _MIN_HZ), _MAX_HZ - _MIN_HZ)
    hi = min(max(hi, lo + _MIN_HZ), _MAX_HZ)
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x, axis=0)


def stereo(x: np.ndarray, pan: float = 0.0) -> np.ndarray:
    """Equal-power pan of a mono signal; pan in [-1, 1]."""
    a = (pan + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], axis=1)


def place(dst: np.ndarray, src: np.ndarray, at: float, gain: float = 1.0) -> None:
    """Mix `src` into `dst` starting at `at` seconds, clipping to bounds."""
    i = int(at * SR)
    if i >= len(dst) or i + len(src) <= 0:
        return
    s0 = max(0, -i)
    i = max(i, 0)
    n = min(len(src) - s0, len(dst) - i)
    dst[i : i + n] += src[s0 : s0 + n] * gain


@lru_cache(maxsize=4)
def _impulse(seconds: float, damp_hz: float, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    t = t_axis(seconds)
    decay = np.exp(-6.9 * t / seconds)
    ir = rng.standard_normal((len(t), 2)) * decay[:, None]
    ir = lowpass(ir, damp_hz)
    pre = np.zeros((int(0.018 * SR), 2))
    ir = np.concatenate([pre, ir])
    return ir / np.sqrt(np.sum(ir**2) / 2)


def reverb(x: np.ndarray, wet: float, seconds: float = 2.4, damp_hz: float = 6000) -> np.ndarray:
    """Stereo algorithmic-ish reverb: convolution with decaying filtered noise."""
    if x.ndim == 1:
        x = stereo(x)
    ir = _impulse(seconds, damp_hz, 3)
    tail = np.stack([fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], axis=1)
    return x * (1 - wet * 0.5) + tail * wet * 0.35


def fade(x: np.ndarray, fade_in: float = 0.0, fade_out: float = 0.0) -> np.ndarray:
    x = x.copy()
    if fade_in > 0:
        n = min(int(fade_in * SR), len(x))
        if n > 0:
            ramp = np.linspace(0, 1, n) ** 2
            x[:n] *= ramp if x.ndim == 1 else ramp[:, None]
    if fade_out > 0:
        n = min(int(fade_out * SR), len(x))
        if n > 0:
            ramp = np.linspace(1, 0, n) ** 2
            x[-n:] *= ramp if x.ndim == 1 else ramp[:, None]
    return x


def rms_db(x: np.ndarray) -> float:
    if x.size == 0:
        return float(20 * np.log10(1e-12))
    return float(20 * np.log10(np.sqrt(np.mean(x**2)) + 1e-12))


def to_rms(x: np.ndarray, db: float) -> np.ndarray:
    if x.size == 0:
        return x.copy()
    return x * 10 ** ((db - rms_db(x)) / 20)

"""Unit tests for Python audio DSP, SFX, library, and mix edge cases."""

from __future__ import annotations

import concurrent.futures
import json
import math
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest import mock

import numpy as np
import soundfile as sf

ROOT = str(Path(__file__).resolve().parent.parent)
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from audio import dsp, library, mix, sfx


def _write_wav(path: Path, data: np.ndarray, sr: int = dsp.SR) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(path, data.astype(np.float32), sr, subtype="FLOAT")
    return path


def _make_fake_ffmpeg_for_mix(
    recorded_args: list[list[str]],
    loudnorm_responses: dict[str, dict[str, str]] | None = None,
    fail_on_premaster: bool = False,
):
    """Return a fake `mix.ffmpeg` implementation that writes valid WAVs and records args."""
    loudnorm_responses = loudnorm_responses or {}

    def fake_ffmpeg(args: list[str]) -> str:
        recorded_args.append(list(args))
        # Loudnorm analysis pass writes to `-f null -`.
        if "-f" in args and "null" in args:
            in_path = Path(args[args.index("-i") + 1])
            stats = loudnorm_responses.get(
                in_path.name,
                {
                    "input_i": "-16.00",
                    "input_tp": "-2.00",
                    "input_lra": "3.00",
                    "input_thresh": "-26.00",
                    "output_i": "-14.00",
                    "output_tp": "-1.50",
                    "output_lra": "3.00",
                    "output_thresh": "-24.00",
                    "normalization_type": "linear",
                    "target_offset": "0.10",
                },
            )
            return "[Parsed_loudnorm_0 @ 0x0]\n" + json.dumps(stats) + "\n"

        out_path = Path(args[-1])
        if fail_on_premaster and out_path.name == "premaster.wav":
            raise RuntimeError("simulated ffmpeg failure")
        # Copy or synthesize a short valid stereo WAV so downstream reads succeed.
        in_path = Path(args[args.index("-i") + 1])
        data, sr = sf.read(in_path, dtype="float32", always_2d=True)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        sf.write(out_path, data, sr, subtype="FLOAT")
        return ""

    return fake_ffmpeg


class TestDspEdgeCases(unittest.TestCase):
    def test_fade_tiny_fade_out_and_fade_in(self) -> None:
        mono = np.ones(1000, dtype=np.float32)
        stereo = np.ones((1000, 2), dtype=np.float32)

        # fade_out > 0 but int(fade_out * SR) == 0 used to trigger x[-0:] broadcast crash.
        out_mono = dsp.fade(mono, fade_in=1e-6, fade_out=1e-6)
        out_stereo = dsp.fade(stereo, fade_in=1e-6, fade_out=1e-6)
        np.testing.assert_array_equal(out_mono, mono)
        np.testing.assert_array_equal(out_stereo, stereo)

        # Empty arrays should also succeed without crashing.
        empty = np.zeros((0, 2), dtype=np.float32)
        self.assertEqual(dsp.fade(empty, fade_in=0.1, fade_out=0.1).shape, (0, 2))

    def test_highpass_and_bandpass_clamp_frequencies(self) -> None:
        rng = np.random.default_rng(0)
        x = rng.standard_normal((1024, 2))

        for hz in (-100.0, 0.0, dsp.SR / 2, dsp.SR * 2):
            y_hi = dsp.highpass(x, hz)
            self.assertEqual(y_hi.shape, x.shape)
            self.assertTrue(np.all(np.isfinite(y_hi)))
            y_lo = dsp.lowpass(x, hz)
            self.assertEqual(y_lo.shape, x.shape)
            self.assertTrue(np.all(np.isfinite(y_lo)))

        empty = np.zeros((0, 2), dtype=np.float32)
        self.assertEqual(dsp.lowpass(empty, 1000.0).shape, (0, 2))
        self.assertEqual(dsp.highpass(empty, 100.0).shape, (0, 2))
        self.assertEqual(dsp.bandpass(empty, 100.0, 1000.0).shape, (0, 2))

        for lo, hi in [
            (-50.0, 1000.0),
            (0.0, 1000.0),
            (100.0, dsp.SR / 2),
            (100.0, dsp.SR * 2),
            (dsp.SR / 2, dsp.SR),
            (1000.0, 1000.0),
            (2000.0, 500.0),
        ]:
            y = dsp.bandpass(x, lo, hi)
            self.assertEqual(y.shape, x.shape)
            self.assertTrue(np.all(np.isfinite(y)))

    def test_rms_db_and_to_rms_empty_array(self) -> None:
        empty = np.zeros((0, 2), dtype=np.float32)
        db = dsp.rms_db(empty)
        self.assertTrue(math.isfinite(db))
        scaled = dsp.to_rms(empty, -20.0)
        self.assertEqual(scaled.shape, (0, 2))


class TestSfxEdgeCases(unittest.TestCase):
    def test_whoosh_guards_peak_bounds(self) -> None:
        for peak in (-0.2, 0.0, 0.5, 1.0):
            out = sfx.whoosh(seconds=0.5, peak=peak)
            self.assertEqual(out.shape, (int(0.5 * dsp.SR), 2))
            self.assertTrue(np.all(np.isfinite(out)))

        empty = sfx.whoosh(seconds=0.0, peak=0.1)
        self.assertEqual(empty.shape, (0, 2))

    def test_pop_negative_step_seed(self) -> None:
        for step in (-1, -7, -100):
            out = sfx.pop(step=step)
            self.assertEqual(out.ndim, 2)
            self.assertEqual(out.shape[1], 2)
            self.assertTrue(np.all(np.isfinite(out)))

    def test_key_negative_seed(self) -> None:
        out = sfx.key(-0.5)
        self.assertEqual(out.ndim, 2)
        self.assertEqual(out.shape[1], 2)
        self.assertTrue(np.all(np.isfinite(out)))


class TestLibraryEdgeCases(unittest.TestCase):
    def test_decode_atomic_write_and_cleanup_on_failure(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            src = _write_wav(root / "src.wav", np.full((480, 2), 0.25, dtype=np.float32))
            cache = root / "cache"
            targets: list[Path] = []

            def fake_run_fail(cmd: list[str], check: bool = False):
                target = Path(cmd[-1])
                targets.append(target)
                # Simulate an interrupted/partial write before failing.
                target.write_bytes(b"RIFFpartial")
                raise subprocess.CalledProcessError(1, cmd)

            with mock.patch("audio.library.subprocess.run", side_effect=fake_run_fail):
                with self.assertRaises(subprocess.CalledProcessError):
                    library.decode(src, cache)

            # No final or temp files should be left in cache after failure.
            self.assertEqual(list(cache.iterdir()), [])

            targets.clear()
            replace_calls: list[tuple[Path, Path]] = []
            real_replace = library.os.replace if hasattr(library, "os") else __import__("os").replace

            def spy_replace(a, b):
                replace_calls.append((Path(a), Path(b)))
                return real_replace(a, b)

            def fake_run_ok(cmd: list[str], check: bool = False):
                target = Path(cmd[-1])
                targets.append(target)
                _write_wav(target, np.full((480, 2), 0.25, dtype=np.float32))
                return subprocess.CompletedProcess(cmd, 0)

            with (
                mock.patch("audio.library.subprocess.run", side_effect=fake_run_ok),
                mock.patch("os.replace", side_effect=spy_replace),
            ):
                audio = library.decode(src, cache)

            self.assertEqual(audio.shape, (480, 2))
            self.assertEqual(len(replace_calls), 1)
            tmp_written, final_cache = replace_calls[0]
            self.assertNotEqual(tmp_written, final_cache)
            self.assertEqual(tmp_written.parent, cache)
            self.assertEqual(final_cache.parent, cache)
            self.assertEqual(list(cache.iterdir()), [final_cache])

    def test_decode_concurrent_writes_do_not_corrupt_cache(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            expected = np.linspace(-0.5, 0.5, 4800, dtype=np.float32)
            expected_stereo = np.stack([expected, expected], axis=1)
            src = _write_wav(root / "src.wav", expected_stereo)
            cache = root / "cache"
            barrier = threading.Barrier(4)

            def fake_run(cmd: list[str], check: bool = False):
                target = Path(cmd[-1])
                try:
                    barrier.wait(timeout=2.0)
                except threading.BrokenBarrierError:
                    pass
                time.sleep(0.01)
                _write_wav(target, expected_stereo)
                return subprocess.CompletedProcess(cmd, 0)

            with mock.patch("audio.library.subprocess.run", side_effect=fake_run):
                with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
                    results = list(pool.map(lambda _: library.decode(src, cache), range(4)))

            for arr in results:
                self.assertEqual(arr.shape, expected_stereo.shape)
                np.testing.assert_allclose(arr, expected_stereo, atol=1e-5)
            # Only the single final cached WAV should remain.
            self.assertEqual(len(list(cache.iterdir())), 1)

    def test_sound_library_pick_zero_sample_audio(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            sounds = root / "sounds"
            _write_wav(sounds / "pop" / "empty.wav", np.zeros((0, 2), dtype=np.float32))
            cache = root / "cache"

            with mock.patch("audio.library.decode", return_value=np.zeros((0, 2), dtype=np.float32)):
                lib = library.SoundLibrary(sounds, cache)
                picked = lib.pick("pop", 0)
            self.assertEqual(picked.shape, (0, 2))

    def test_music_bed_edge_lengths_start_and_crossfade_zero(self) -> None:
        t = np.arange(dsp.SR, dtype=np.float32) / dsp.SR  # 1.0s track
        tone = np.stack([np.sin(2 * np.pi * 220 * t) * 0.2] * 2, axis=1).astype(np.float32)
        dummy_path = Path("track.wav")
        dummy_cache = Path("cache")

        # 1. start >= len(track)
        with mock.patch("audio.library.decode", return_value=tone):
            bed = library.music_bed(dummy_path, seconds=2.0, cache=dummy_cache, start=5.0)
        self.assertEqual(bed.shape, (int(2.0 * dsp.SR), 2))
        self.assertTrue(np.all(np.isfinite(bed)))

        # 2. remaining track <= 2 * xf (1.0s track with default 2.0s crossfade, need 3.0s)
        with mock.patch("audio.library.decode", return_value=tone):
            bed = library.music_bed(dummy_path, seconds=3.0, cache=dummy_cache, crossfade=2.0)
        self.assertEqual(bed.shape, (int(3.0 * dsp.SR), 2))
        self.assertTrue(np.all(np.isfinite(bed)))

        # 3. crossfade == 0 (used to hit out[-0:] broadcast bug)
        with mock.patch("audio.library.decode", return_value=tone):
            bed = library.music_bed(dummy_path, seconds=3.0, cache=dummy_cache, crossfade=0.0)
        self.assertEqual(bed.shape, (int(3.0 * dsp.SR), 2))
        self.assertTrue(np.all(np.isfinite(bed)))

        # 4. empty decoded track
        with mock.patch("audio.library.decode", return_value=np.zeros((0, 2), dtype=np.float32)):
            bed = library.music_bed(dummy_path, seconds=1.0, cache=dummy_cache)
        self.assertEqual(bed.shape, (dsp.SR, 2))
        self.assertTrue(np.all(np.isfinite(bed)))

        # 5. normal crossfade loop matches iterative crossfade exactly
        long_t = np.arange(dsp.SR * 2, dtype=np.float32) / dsp.SR  # 2.0s track
        long_tone = np.stack([np.sin(2 * np.pi * 220 * long_t) * 0.2] * 2, axis=1).astype(np.float32)
        with mock.patch("audio.library.decode", return_value=long_tone):
            bed = library.music_bed(dummy_path, seconds=5.0, cache=dummy_cache, crossfade=0.5)
        xf = int(0.5 * dsp.SR)
        n = int(5.0 * dsp.SR)
        ref = long_tone.copy()
        while len(ref) < n:
            ramp = np.linspace(0, 1, xf)[:, None]
            joint = ref[-xf:] * (1 - ramp) + long_tone[:xf] * ramp
            ref = np.concatenate([ref[:-xf], joint, long_tone[xf:]])
        expected = dsp.to_rms(dsp.fade(ref[:n], 0.3, 1.8), -20.0).astype(np.float32)
        np.testing.assert_allclose(bed, expected, atol=1e-6)


class TestMixEdgeCases(unittest.TestCase):
    def _setup_project(self, root: Path, cfg: dict, voice_data: np.ndarray | None = None) -> Path:
        proj = root / "proj"
        (proj / "build").mkdir(parents=True, exist_ok=True)
        (proj / "source").mkdir(parents=True, exist_ok=True)
        if voice_data is None:
            t = np.arange(dsp.SR, dtype=np.float32) / dsp.SR
            voice_data = np.stack([np.sin(2 * np.pi * 300 * t) * 0.2] * 2, axis=1).astype(np.float32)
        _write_wav(proj / "source" / "voice.wav", voice_data)
        (proj / "build" / "audio.json").write_text(json.dumps(cfg))
        return proj

    def test_loudness_sanitizes_inf_and_nan(self) -> None:
        silent_json = json.dumps(
            {
                "input_i": "-inf",
                "input_tp": "-inf",
                "input_lra": "0.00",
                "input_thresh": "-70.00",
                "output_i": "-inf",
                "output_tp": "-inf",
                "output_lra": "0.00",
                "output_thresh": "-70.00",
                "normalization_type": "linear",
                "target_offset": "inf",
            }
        )
        with mock.patch("audio.mix.ffmpeg", return_value=silent_json):
            stats = mix.loudness(Path("silent.wav"))
        self.assertIsNone(stats["input_i"])
        self.assertIsNone(stats["input_tp"])
        self.assertIsNone(stats["target_offset"])

        nan_json = json.dumps({"input_i": "nan", "input_tp": "NaN", "target_offset": "inf"})
        with mock.patch("audio.mix.ffmpeg", return_value=nan_json):
            stats_nan = mix.loudness(Path("nan.wav"))
        self.assertIsNone(stats_nan["input_i"])
        self.assertIsNone(stats_nan["input_tp"])
        self.assertIsNone(stats_nan["target_offset"])

    def test_mix_voice_end_clamped(self) -> None:
        for voice_end in (5.0, -1.0, 0.0):
            with self.subTest(voiceEnd=voice_end), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                proj = self._setup_project(root, {"duration": 1.0, "voiceEnd": voice_end, "sfx": []})
                recorded: list[list[str]] = []
                fake_ff = _make_fake_ffmpeg_for_mix(recorded)
                with (
                    mock.patch("audio.mix.library_root", return_value=root / "lib"),
                    mock.patch("audio.mix.decode", side_effect=lambda p, c: sf.read(p, dtype="float32", always_2d=True)[0]),
                    mock.patch("audio.mix.ffmpeg", side_effect=fake_ff),
                ):
                    mix.main(proj)
                self.assertTrue((proj / "build" / "mix.wav").is_file())

    def test_mix_silent_stems_never_pass_inf_or_nan_to_ffmpeg(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            lib = root / "lib"
            silent = np.zeros((dsp.SR, 2), dtype=np.float32)
            _write_wav(lib / "music" / "bed.wav", silent)
            proj = self._setup_project(
                root,
                {"duration": 1.0, "music": {"track": "bed.wav", "under": 11, "level": -22}, "sfx": []},
                voice_data=silent,
            )
            silent_stats = {
                "input_i": "-inf",
                "input_tp": "-inf",
                "input_lra": "0.00",
                "input_thresh": "-70.00",
                "output_i": "-inf",
                "output_tp": "-inf",
                "output_lra": "0.00",
                "output_thresh": "-70.00",
                "normalization_type": "linear",
                "target_offset": "inf",
            }
            recorded: list[list[str]] = []
            fake_ff = _make_fake_ffmpeg_for_mix(
                recorded,
                loudnorm_responses={
                    "voice.wav": silent_stats,
                    "music.wav": silent_stats,
                    "premaster.wav": silent_stats,
                    "mix.wav": silent_stats,
                },
            )
            with (
                mock.patch("audio.mix.library_root", return_value=lib),
                mock.patch("audio.mix.decode", side_effect=lambda p, c: sf.read(p, dtype="float32", always_2d=True)[0]),
                mock.patch("audio.library.decode", side_effect=lambda p, c: sf.read(p, dtype="float32", always_2d=True)[0]),
                mock.patch("audio.mix.ffmpeg", side_effect=fake_ff),
            ):
                mix.main(proj)

            self.assertTrue((proj / "build" / "mix.wav").is_file())
            for cmd in recorded:
                joined = " ".join(cmd).lower()
                self.assertNotIn("nandb", joined)
                self.assertNotIn("infdb", joined)
                self.assertNotIn("measured_i=-inf", joined)
                self.assertNotIn("measured_i=none", joined)
                self.assertNotIn("offset=inf", joined)

    def test_mix_silent_ducked_stem_and_mixed_mode(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            lib = root / "lib"
            t = np.arange(dsp.SR, dtype=np.float32) / dsp.SR
            tone = np.stack([np.sin(2 * np.pi * 220 * t) * 0.2] * 2, axis=1).astype(np.float32)
            _write_wav(lib / "music" / "bed.wav", tone)
            proj = self._setup_project(
                root,
                {"duration": 1.0, "mixed": True, "music": {"track": "bed.wav", "under": 11, "level": -20}, "sfx": []},
                voice_data=tone,
            )
            silent_stats = {
                "input_i": "-inf",
                "input_tp": "-inf",
                "input_lra": "0.00",
                "input_thresh": "-70.00",
                "output_i": "-inf",
                "output_tp": "-inf",
                "output_lra": "0.00",
                "output_thresh": "-70.00",
                "normalization_type": "linear",
                "target_offset": "inf",
            }
            recorded: list[list[str]] = []
            fake_ff = _make_fake_ffmpeg_for_mix(
                recorded,
                loudnorm_responses={"ducked.wav": silent_stats, "mix.wav": silent_stats},
            )
            with (
                mock.patch("audio.mix.library_root", return_value=lib),
                mock.patch("audio.mix.decode", side_effect=lambda p, c: sf.read(p, dtype="float32", always_2d=True)[0]),
                mock.patch("audio.library.decode", side_effect=lambda p, c: sf.read(p, dtype="float32", always_2d=True)[0]),
                mock.patch("audio.mix.ffmpeg", side_effect=fake_ff),
            ):
                mix.main(proj)
            self.assertTrue((proj / "build" / "mix.wav").is_file())
            for cmd in recorded:
                joined = " ".join(cmd).lower()
                self.assertNotIn("nandb", joined)
                self.assertNotIn("infdb", joined)

    def test_mix_missing_music_track_raises_clear_error(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            proj = self._setup_project(
                root,
                {"duration": 1.0, "music": {"track": "missing-track.mp3"}, "sfx": []},
            )
            with (
                mock.patch("audio.mix.library_root", return_value=root / "lib"),
                mock.patch("audio.mix.decode", side_effect=lambda p, c: sf.read(p, dtype="float32", always_2d=True)[0]),
                mock.patch("audio.mix.music_bed") as mock_bed,
                mock.patch("audio.mix.ffmpeg", side_effect=_make_fake_ffmpeg_for_mix([])),
            ):
                with self.assertRaises(FileNotFoundError) as ctx:
                    mix.main(proj)
            self.assertIn("music track not found", str(ctx.exception))
            self.assertIn("missing-track.mp3", str(ctx.exception))
            mock_bed.assert_not_called()

    def test_mix_uses_unique_work_dir_and_cleans_up(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            proj = self._setup_project(root, {"duration": 1.0, "sfx": []})

            work_dirs: list[Path] = []
            for _ in range(2):
                recorded: list[list[str]] = []
                fake_ff = _make_fake_ffmpeg_for_mix(recorded)
                with (
                    mock.patch("audio.mix.library_root", return_value=root / "lib"),
                    mock.patch("audio.mix.decode", side_effect=lambda p, c: sf.read(p, dtype="float32", always_2d=True)[0]),
                    mock.patch("audio.mix.ffmpeg", side_effect=fake_ff),
                ):
                    mix.main(proj, out_path="build/preview/mix.wav")

                voice_inputs = [
                    Path(cmd[cmd.index("-i") + 1]).parent
                    for cmd in recorded
                    if "-i" in cmd and Path(cmd[cmd.index("-i") + 1]).name == "voice.wav"
                ]
                self.assertTrue(voice_inputs)
                work_dir = voice_inputs[0]
                work_dirs.append(work_dir)
                # Working directory must be cleaned up after the run finishes.
                self.assertFalse(work_dir.exists())

            # Two preview mix runs must not collide on the same shared directory.
            self.assertNotEqual(work_dirs[0], work_dirs[1])
            self.assertFalse((proj / "build" / "audio-preview").exists())

            # Also verify cleanup happens in `finally` when ffmpeg fails mid-run.
            recorded_err: list[list[str]] = []
            with (
                mock.patch("audio.mix.library_root", return_value=root / "lib"),
                mock.patch("audio.mix.decode", side_effect=lambda p, c: sf.read(p, dtype="float32", always_2d=True)[0]),
                mock.patch("audio.mix.ffmpeg", side_effect=_make_fake_ffmpeg_for_mix(recorded_err, fail_on_premaster=True)),
            ):
                with self.assertRaises(RuntimeError):
                    mix.main(proj, out_path="build/preview/mix.wav")

            err_work_dirs = [
                Path(cmd[cmd.index("-i") + 1]).parent
                for cmd in recorded_err
                if "-i" in cmd and Path(cmd[cmd.index("-i") + 1]).name == "voice.wav"
            ]
            self.assertTrue(err_work_dirs)
            self.assertFalse(err_work_dirs[0].exists())


if __name__ == "__main__":
    unittest.main()

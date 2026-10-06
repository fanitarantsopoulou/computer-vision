"""Smoke test: the MediaPipe tracker loads and runs on synthetic frames (no camera needed)."""

import numpy as np
import pytest

from gesture_vision.config import TrackerConfig
from gesture_vision.viz import FPSMeter

mp_tracker = pytest.importorskip("gesture_vision.tracking.mediapipe_tracker")


@pytest.fixture
def tracker():
    cfg = TrackerConfig()
    if not cfg.model_path.is_file():
        pytest.skip("model not downloaded; run scripts/download_model.py")
    with mp_tracker.MediaPipeHandTracker(cfg) as t:
        yield t


def test_blank_frames_have_no_hands(tracker):
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    for ts in (0, 33, 66):
        result = tracker.process(frame, ts)
        assert result.hands == ()
        assert (result.frame_width, result.frame_height) == (640, 480)


def test_missing_model_raises(tmp_path):
    with pytest.raises(mp_tracker.ModelNotFoundError):
        mp_tracker.MediaPipeHandTracker(TrackerConfig(model_path=tmp_path / "nope.task"))


def test_fps_meter():
    m = FPSMeter(smoothing=0.0)
    m.tick(0.0)
    assert m.tick(0.05) == pytest.approx(20.0)


def test_overlay_draws_fake_hand():
    from gesture_vision.tracking import HandObservation, TrackingResult, normalize_landmarks
    from gesture_vision.viz import draw_hands, draw_stats

    lms = np.random.default_rng(0).uniform(0.2, 0.8, size=(21, 3)).astype(np.float32)
    hand = HandObservation("Right", 0.98, lms, lms, normalize_landmarks(lms))
    image = np.zeros((480, 640, 3), dtype=np.uint8)
    draw_hands(image, TrackingResult(0, 640, 480, (hand,)))
    draw_stats(image, 30.0, 12.0, 1)
    assert image.any()
    assert hand.feature_vector().shape == (63,)

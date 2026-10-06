import numpy as np
import pytest

from gesture_vision.tracking import Landmark, normalize_landmarks


def _random_hand(seed: int = 0) -> np.ndarray:
    return np.random.default_rng(seed).normal(size=(21, 3)).astype(np.float32)


def test_wrist_at_origin_and_unit_scale():
    out = normalize_landmarks(_random_hand())
    np.testing.assert_allclose(out[Landmark.WRIST], 0, atol=1e-6)
    assert np.linalg.norm(out[Landmark.MIDDLE_MCP]) == pytest.approx(1.0, abs=1e-5)


def test_invariant_to_translation_and_scale():
    hand = _random_hand()
    moved = hand * 3.7 + np.array([0.5, -2.0, 1.0], dtype=np.float32)
    np.testing.assert_allclose(normalize_landmarks(hand), normalize_landmarks(moved), atol=1e-5)


def test_degenerate_hand_returns_zeros():
    assert not normalize_landmarks(np.zeros((21, 3))).any()


def test_rejects_wrong_shape():
    with pytest.raises(ValueError):
        normalize_landmarks(np.zeros((20, 3)))

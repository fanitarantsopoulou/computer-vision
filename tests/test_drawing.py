import numpy as np
import pytest

from gesture_vision.gestures import PinchDetector
from gesture_vision.interaction import AirCanvas, recognize

RNG = np.random.default_rng(0)


def _jitter(pts: np.ndarray, px: float = 3.0) -> np.ndarray:
    return pts + RNG.normal(scale=px, size=pts.shape)


def _polygon(corners: list[tuple[float, float]], per_side: int = 20) -> np.ndarray:
    corners = np.array(corners + [corners[0]], dtype=float)
    return np.concatenate([np.linspace(a, b, per_side, endpoint=False) for a, b in zip(corners[:-1], corners[1:])])


def test_recognizes_line():
    pts = _jitter(np.linspace((100, 100), (400, 250), 40))
    assert recognize(pts).label == "line"


def test_recognizes_circle():
    t = np.linspace(0, 2 * np.pi, 60)
    pts = _jitter(np.stack([300 + 100 * np.cos(t), 300 + 100 * np.sin(t)], axis=1))
    shape = recognize(pts)
    assert shape.label == "circle"
    assert shape.radius == pytest.approx(100, abs=8)


def test_recognizes_rectangle():
    assert recognize(_jitter(_polygon([(100, 100), (400, 100), (400, 300), (100, 300)]))).label == "rectangle"


def test_recognizes_triangle():
    assert recognize(_jitter(_polygon([(250, 100), (400, 350), (100, 350)]))).label == "triangle"


def test_open_scribble_stays_free():
    t = np.linspace(0, 3 * np.pi, 60)
    pts = np.stack([100 + 60 * t, 300 + 80 * np.sin(t)], axis=1)  # open wave
    assert recognize(pts).label == "free"


def test_pinch_hysteresis_and_debounce():
    p = PinchDetector(start_threshold=0.3, release_threshold=0.45, release_frames=3)
    assert not p.update(0.35)  # between thresholds, not started
    assert p.update(0.2)  # start
    assert p.update(0.4)  # between thresholds, stays active
    assert p.update(0.6) and p.update(0.6)  # 2 open frames: still active (debounce)
    assert not p.update(0.6)  # 3rd open frame releases
    assert p.update(0.1) and not p.update(None)  # losing the hand releases immediately


def _drag(canvas: AirCanvas, start, end, steps: int = 30) -> None:
    for p in np.linspace(start, end, steps):
        canvas.update(np.array(p, dtype=np.float32), pinching=True)
    canvas.update(np.array(end, dtype=np.float32), pinching=False)


def test_canvas_draws_stroke_and_snaps_line():
    canvas = AirCanvas()
    _drag(canvas, (100, 200), (500, 200))
    assert [o.shape.label for o in canvas.objects] == ["line"]

    image = np.zeros((480, 640, 3), dtype=np.uint8)
    canvas.render(image)
    assert image.any()

    canvas.handle_key(ord("z"))
    assert canvas.objects == []


def test_pinch_on_shape_moves_it_instead_of_drawing():
    canvas = AirCanvas()
    t = np.linspace(0, 2 * np.pi, 60)
    for p in np.stack([200 + 50 * np.cos(t), 200 + 50 * np.sin(t)], axis=1):
        canvas.update(p.astype(np.float32), pinching=True)
    canvas.update(None, pinching=False)
    assert [o.shape.label for o in canvas.objects] == ["circle"]

    _drag(canvas, (200, 200), (400, 300))  # grab at center, drag
    assert len(canvas.objects) == 1
    np.testing.assert_allclose(canvas.objects[0].shape.points[0], (400, 300), atol=3)


def test_shape_hit_testing():
    square = recognize(_polygon([(100, 100), (300, 100), (300, 300), (100, 300)]))
    assert square.distance_to((200, 200)) == 0
    assert square.distance_to((350, 200)) == pytest.approx(50, abs=3)
    line = recognize(np.linspace((0, 0), (100, 0), 20))
    assert line.distance_to((50, 10)) == pytest.approx(10, abs=0.5)

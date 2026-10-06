import numpy as np

from gesture_vision.features import finger_extensions
from gesture_vision.gestures import FistReleaseDetector, HandPose, classify_pose
from gesture_vision.interaction import ParticleBurst, Playground
from gesture_vision.tracking import HandObservation, Landmark, TrackingResult, normalize_landmarks

OPEN, FIST, OTHER = HandPose.OPEN, HandPose.FIST, HandPose.OTHER

_MCPS = (Landmark.INDEX_MCP, Landmark.MIDDLE_MCP, Landmark.RING_MCP, Landmark.PINKY_MCP)
_TIPS = (Landmark.INDEX_TIP, Landmark.MIDDLE_TIP, Landmark.RING_TIP, Landmark.PINKY_TIP)


def _hand(extension: float) -> HandObservation:
    """Synthetic hand: MCPs 1 unit from the wrist, fingertips `extension` units away; thumb far from index."""
    world = np.zeros((21, 3), dtype=np.float32)
    for i, (mcp, tip) in enumerate(zip(_MCPS, _TIPS)):
        direction = np.array([(i - 1.5) * 0.2, -1.0, 0.0])
        direction /= np.linalg.norm(direction)
        world[mcp] = direction
        world[tip] = direction * extension
    world[Landmark.THUMB_TIP] = (2.0, 0.0, 0.0)
    image = np.full((21, 3), 0.5, dtype=np.float32)
    return HandObservation("Right", 1.0, image, world, normalize_landmarks(world))


def test_pose_classification():
    assert classify_pose(finger_extensions(_hand(2.0))) is OPEN
    assert classify_pose(finger_extensions(_hand(1.0))) is FIST
    assert classify_pose(finger_extensions(_hand(1.4))) is OTHER


def test_fist_then_open_fires_once():
    d = FistReleaseDetector(min_fist_ms=150, max_gap_ms=700, cooldown_ms=600)
    fired = [d.update(p, t) for p, t in [(FIST, 0), (FIST, 100), (FIST, 200), (OTHER, 250), (OPEN, 300), (OPEN, 350)]]
    assert fired == [False, False, False, False, True, False]


def test_short_fist_or_slow_open_does_not_fire():
    d = FistReleaseDetector(min_fist_ms=150, max_gap_ms=700)
    assert not d.update(FIST, 0) and not d.update(OPEN, 50)  # fist too short
    d = FistReleaseDetector(min_fist_ms=150, max_gap_ms=700)
    for t in (1000, 1100, 1200):
        d.update(FIST, t)
    assert not d.update(OPEN, 2000)  # opened too late


def test_lost_hand_resets():
    d = FistReleaseDetector(min_fist_ms=100)
    d.update(FIST, 0)
    d.update(FIST, 200)
    d.update(None, 250)
    assert not d.update(OPEN, 300)


def test_particles_spawn_and_expire():
    fx = ParticleBurst(seed=0)
    fx.burst(np.array([320, 240]))
    fx.update(0)
    fx.update(100)
    image = np.zeros((480, 640, 3), dtype=np.uint8)
    fx.render(image)
    assert image.any()
    for t in range(200, 2000, 100):
        fx.update(t)
    assert not fx.active


def test_playground_bursts_on_fist_release():
    pg = Playground()
    frames = [(_hand(1.0), t) for t in (0, 100, 200)] + [(_hand(2.0), 300)]
    for hand, t in frames:
        pg.update(TrackingResult(t, 640, 480, (hand,)))
    assert pg.effects.active
    assert pg.canvas.objects == []  # the fist did not draw anything

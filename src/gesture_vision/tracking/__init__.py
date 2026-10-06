"""Hand tracking layer. Import MediaPipeHandTracker from tracking.mediapipe_tracker (kept lazy: it loads MediaPipe)."""

from gesture_vision.tracking.base import HandTracker
from gesture_vision.tracking.normalization import normalize_landmarks
from gesture_vision.tracking.types import NUM_LANDMARKS, HandObservation, Landmark, TrackingResult

__all__ = [
    "NUM_LANDMARKS",
    "HandObservation",
    "HandTracker",
    "Landmark",
    "TrackingResult",
    "normalize_landmarks",
]

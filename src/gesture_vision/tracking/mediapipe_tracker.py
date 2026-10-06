"""HandTracker backed by the MediaPipe Tasks HandLandmarker (VIDEO mode: detection + inter-frame tracking)."""

from __future__ import annotations

import logging
import time
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python import vision

from gesture_vision.config import TrackerConfig
from gesture_vision.tracking.base import HandTracker
from gesture_vision.tracking.normalization import normalize_landmarks
from gesture_vision.tracking.types import HandObservation, TrackingResult

log = logging.getLogger(__name__)


class ModelNotFoundError(FileNotFoundError):
    pass


def _to_array(landmarks) -> np.ndarray:
    return np.array([(lm.x, lm.y, lm.z) for lm in landmarks], dtype=np.float32)


class MediaPipeHandTracker(HandTracker):
    def __init__(self, config: TrackerConfig) -> None:
        model_path = Path(config.model_path)
        if not model_path.is_file():
            raise ModelNotFoundError(
                f"Hand landmarker model not found at {model_path}. "
                "Run: python scripts/download_model.py"
            )
        options = vision.HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(model_path)),
            running_mode=vision.RunningMode.VIDEO,
            num_hands=config.max_hands,
            min_hand_detection_confidence=config.min_detection_confidence,
            min_hand_presence_confidence=config.min_presence_confidence,
            min_tracking_confidence=config.min_tracking_confidence,
        )
        self._landmarker = vision.HandLandmarker.create_from_options(options)
        log.info("MediaPipe HandLandmarker ready (model=%s, max_hands=%d)", model_path.name, config.max_hands)

    def process(self, image_bgr: np.ndarray, timestamp_ms: int) -> TrackingResult:
        h, w = image_bgr.shape[:2]
        rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

        t0 = time.perf_counter()
        raw = self._landmarker.detect_for_video(mp_image, timestamp_ms)
        inference_ms = (time.perf_counter() - t0) * 1000

        hands = []
        for img_lms, world_lms, handedness in zip(raw.hand_landmarks, raw.hand_world_landmarks, raw.handedness):
            world = _to_array(world_lms)
            top = handedness[0]
            hands.append(
                HandObservation(
                    handedness=top.category_name,
                    handedness_score=float(top.score),
                    image_landmarks=_to_array(img_lms),
                    world_landmarks=world,
                    normalized_landmarks=normalize_landmarks(world),
                )
            )
        return TrackingResult(
            timestamp_ms=timestamp_ms,
            frame_width=w,
            frame_height=h,
            hands=tuple(hands),
            inference_ms=inference_ms,
        )

    def close(self) -> None:
        if self._landmarker is not None:
            self._landmarker.close()
            self._landmarker = None

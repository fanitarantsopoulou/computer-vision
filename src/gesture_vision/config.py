"""Runtime configuration and CLI parsing."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MODEL_PATH = PROJECT_ROOT / "models" / "hand_landmarker.task"


@dataclass(frozen=True)
class CameraConfig:
    index: int = 0
    width: int = 1280
    height: int = 720
    mirror: bool = True  # selfie view; also makes MediaPipe handedness labels match the user's hands


@dataclass(frozen=True)
class TrackerConfig:
    model_path: Path = DEFAULT_MODEL_PATH
    max_hands: int = 2
    min_detection_confidence: float = 0.5
    min_presence_confidence: float = 0.5
    min_tracking_confidence: float = 0.5


@dataclass(frozen=True)
class AppConfig:
    camera: CameraConfig
    tracker: TrackerConfig
    headless: bool = False
    max_frames: int | None = None
    print_landmarks: bool = False
    draw: bool = False
    log_level: str = "INFO"


def parse_args(argv: list[str] | None = None) -> AppConfig:
    p = argparse.ArgumentParser(prog="gesture-vision", description="Real-time hand landmark tracking.")
    p.add_argument("--camera", type=int, default=0, help="webcam index (default: 0)")
    p.add_argument("--width", type=int, default=1280)
    p.add_argument("--height", type=int, default=720)
    p.add_argument("--no-mirror", action="store_true", help="disable horizontal flip")
    p.add_argument("--model", type=Path, default=DEFAULT_MODEL_PATH, help="path to hand_landmarker.task")
    p.add_argument("--max-hands", type=int, default=2)
    p.add_argument("--min-detection-confidence", type=float, default=0.5)
    p.add_argument("--min-tracking-confidence", type=float, default=0.5)
    p.add_argument("--headless", action="store_true", help="no window (for testing/benchmarking)")
    p.add_argument("--max-frames", type=int, default=None, help="stop after N frames")
    p.add_argument("--print-landmarks", action="store_true", help="log normalized landmarks ~1x/sec")
    p.add_argument("--draw", action="store_true", help="interactive mode: draw, move shapes, fist->open burst")
    p.add_argument("--log-level", default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR"])
    a = p.parse_args(argv)

    return AppConfig(
        camera=CameraConfig(index=a.camera, width=a.width, height=a.height, mirror=not a.no_mirror),
        tracker=TrackerConfig(
            model_path=a.model,
            max_hands=a.max_hands,
            min_detection_confidence=a.min_detection_confidence,
            min_tracking_confidence=a.min_tracking_confidence,
        ),
        headless=a.headless,
        max_frames=a.max_frames,
        print_landmarks=a.print_landmarks,
        draw=a.draw,
        log_level=a.log_level,
    )

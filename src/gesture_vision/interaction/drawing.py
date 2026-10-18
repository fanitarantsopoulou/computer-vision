"""Air canvas: pinch on empty space draws a stroke; pinch on a shape grabs and drags it.

Input is just a cursor position and a pinch flag, so this layer knows nothing about hand tracking.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import cv2
import numpy as np

from gesture_vision.interaction.shapes import Shape, recognize

log = logging.getLogger(__name__)

COLORS = ((0, 0, 255), (0, 200, 0), (255, 120, 0), (0, 220, 255), (255, 0, 255))  # BGR
THICKNESS = 4
MIN_STEP_PX = 2.0
GRAB_TOLERANCE_PX = 25.0
FILL_ALPHA = 0.35


@dataclass
class CanvasObject:
    shape: Shape
    color: tuple[int, int, int]


class AirCanvas:
    def __init__(self, snap_shapes: bool = True) -> None:
        self.snap_shapes = snap_shapes
        self.objects: list[CanvasObject] = []
        self._stroke: list[np.ndarray] = []
        self._grabbed: CanvasObject | None = None
        self._hover: CanvasObject | None = None
        self._cursor: np.ndarray | None = None
        self._was_pinching = False
        self._color_idx = 0

    @property
    def color(self) -> tuple[int, int, int]:
        return COLORS[self._color_idx]

    def update(self, cursor: np.ndarray | None, pinching: bool) -> None:
        """cursor: smoothed pixel position (None = no hand). pinching: debounced pinch state."""
        pinching = pinching and cursor is not None
        prev_cursor, self._cursor = self._cursor, cursor

        if pinching and not self._was_pinching:
            self._grabbed = self.object_at(cursor)
            if self._grabbed is not None:  # bring to front
                self.objects = [o for o in self.objects if o is not self._grabbed]  # == would compare numpy arrays
                self.objects.append(self._grabbed)
        elif not pinching and self._was_pinching:
            if self._grabbed is not None:
                self._grabbed = None
            elif self._stroke:
                self._finish_stroke()
        self._was_pinching = pinching

        if pinching and self._grabbed is not None:
            if prev_cursor is not None:
                self._grabbed.shape.translate(cursor - prev_cursor)
        elif pinching:
            if not self._stroke or np.linalg.norm(cursor - self._stroke[-1]) >= MIN_STEP_PX:
                self._stroke.append(cursor.copy())

        self._hover = None if pinching or cursor is None else self.object_at(cursor)

    def object_at(self, point: np.ndarray) -> CanvasObject | None:
        """Topmost object under (or within tolerance of) the point."""
        for obj in reversed(self.objects):
            if obj.shape.distance_to(point) <= GRAB_TOLERANCE_PX:
                return obj
        return None

    def _finish_stroke(self) -> None:
        pts = np.array(self._stroke, dtype=np.float32)
        self._stroke = []
        shape = recognize(pts) if self.snap_shapes else Shape("free", pts)
        if len(shape.points) >= 2 or shape.kind == "circle":
            self.objects.append(CanvasObject(shape, self.color))
            log.debug("Created %s", shape.label)

    def handle_key(self, key: int) -> None:
        if key == ord("c"):
            self.objects.clear()
            self._grabbed = self._hover = None
        elif key == ord("z") and self.objects:
            removed = self.objects.pop()
            if removed is self._grabbed:
                self._grabbed = None
        elif key == ord("s"):
            self.snap_shapes = not self.snap_shapes
        elif key == ord("k"):
            self._color_idx = (self._color_idx + 1) % len(COLORS)

    def render(self, image: np.ndarray) -> None:
        if self.objects:
            fill = image.copy()
            for obj in self.objects:
                if obj.shape.closed:
                    _draw_shape(fill, obj.shape, obj.color, filled=True)
            cv2.addWeighted(fill, FILL_ALPHA, image, 1 - FILL_ALPHA, 0, dst=image)
            for obj in self.objects:
                _draw_shape(image, obj.shape, obj.color)
                if obj is self._grabbed or obj is self._hover:
                    _draw_shape(image, obj.shape, (255, 255, 255), thickness=2)

        if len(self._stroke) >= 2:
            cv2.polylines(image, [np.array(self._stroke, dtype=np.int32)], False, self.color, THICKNESS, cv2.LINE_AA)
        if self._cursor is not None:
            center = tuple(self._cursor.astype(int))
            if self._was_pinching:
                cv2.circle(image, center, 8, self.color, -1, cv2.LINE_AA)
            else:
                cv2.circle(image, center, 10, self.color, 2, cv2.LINE_AA)


def _draw_shape(image: np.ndarray, shape: Shape, color, thickness: int = THICKNESS, filled: bool = False) -> None:
    t = -1 if filled else thickness
    if shape.kind == "circle":
        cx, cy = shape.points[0]
        cv2.circle(image, (int(cx), int(cy)), int(shape.radius), color, t, cv2.LINE_AA)
    elif filled:
        cv2.fillPoly(image, [shape.points.astype(np.int32)], color, cv2.LINE_AA)
    else:
        cv2.polylines(image, [shape.points.astype(np.int32)], shape.closed, color, t, cv2.LINE_AA)

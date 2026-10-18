import { FaceDetector, FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const base = import.meta.env.BASE_URL;

/** Hand landmarks + face presence from a <video>, all on-device (the camera feed never leaves the browser). */
export class Tracker {
  static async create() {
    const vision = await FilesetResolver.forVisionTasks(`${base}wasm`);
    const make = async (Cls, file, extra) => {
      const opts = (delegate) => ({
        baseOptions: { modelAssetPath: `${base}models/${file}`, delegate },
        runningMode: "VIDEO",
        ...extra,
      });
      try {
        return await Cls.createFromOptions(vision, opts("GPU"));
      } catch (e) {
        console.warn(`${file}: GPU delegate failed, using CPU`, e);
        return await Cls.createFromOptions(vision, opts("CPU"));
      }
    };
    const hands = await make(HandLandmarker, "hand_landmarker.task", { numHands: 1 });
    const faces = await make(FaceDetector, "blaze_face_short_range.tflite", { minDetectionConfidence: 0.6 });
    return new Tracker(hands, faces);
  }

  constructor(hands, faces) {
    this.hands = hands;
    this.faces = faces;
    this.lastVideoTime = -1;
    this.lastFaceAt = 0;
    this.faceWidth = 0; // widest face as a fraction of the frame width; 0 = none
  }

  /** Returns {hand: {image, world} | null, faceWidth} or null if the video has no new frame. */
  process(video, nowMs) {
    if (video.readyState < 2 || video.currentTime === this.lastVideoTime) return null;
    this.lastVideoTime = video.currentTime;

    const res = this.hands.detectForVideo(video, nowMs);
    const hand = res.landmarks.length ? { image: res.landmarks[0], world: res.worldLandmarks[0] } : null;

    if (nowMs - this.lastFaceAt > 200) {
      // Faces change slowly; checking ~5x/s keeps the frame rate for hand tracking.
      this.lastFaceAt = nowMs;
      const faces = this.faces.detectForVideo(video, nowMs).detections;
      this.faceWidth = faces.reduce((w, d) => Math.max(w, (d.boundingBox?.width ?? 0) / video.videoWidth), 0);
    }
    return { hand, faceWidth: this.faceWidth };
  }
}

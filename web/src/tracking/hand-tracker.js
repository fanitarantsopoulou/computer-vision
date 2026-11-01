import { FaceDetector, FilesetResolver, HandLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";

const base = import.meta.env.BASE_URL;

/** Hands, body pose + face presence from a <video>, all on-device (the camera feed never leaves the browser). */
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
    const hands = await make(HandLandmarker, "hand_landmarker.task", { numHands: 2 });
    const faces = await make(FaceDetector, "blaze_face_short_range.tflite", { minDetectionConfidence: 0.6 });
    // The body only drives the cartoon avatar; the game still works without it.
    const pose = await make(PoseLandmarker, "pose_landmarker_lite.task", { numPoses: 1 }).catch((e) => {
      console.warn("Pose model unavailable, the avatar stays in the corner", e);
      return null;
    });
    return new Tracker(hands, faces, pose);
  }

  constructor(hands, faces, pose) {
    this.hands = hands;
    this.faces = faces;
    this.pose = pose;
    this.lastPoseAt = 0;
    this.body = null; // 33 pose landmarks of the closest person, or null
    this.lastVideoTime = -1;
    this.lastFaceAt = 0;
    this.faceWidth = 0; // widest face as a fraction of the frame width; 0 = none
  }

  /** Returns {hands: [{image, world}], body, faceWidth} or null if the video has no new frame. */
  process(video, nowMs) {
    if (video.readyState < 2 || video.currentTime === this.lastVideoTime) return null;
    this.lastVideoTime = video.currentTime;

    const res = this.hands.detectForVideo(video, nowMs);
    const hands = res.landmarks.map((image, i) => ({ image, world: res.worldLandmarks[i] }));

    if (this.pose && nowMs - this.lastPoseAt > 66) {
      // ~15 poses per second is plenty for an avatar and leaves time for the hands.
      this.lastPoseAt = nowMs;
      this.body = this.pose.detectForVideo(video, nowMs).landmarks[0] ?? null;
    }

    if (nowMs - this.lastFaceAt > 200) {
      // Faces change slowly; checking ~5x/s keeps the frame rate for hand tracking.
      this.lastFaceAt = nowMs;
      const faces = this.faces.detectForVideo(video, nowMs).detections;
      this.faceWidth = faces.reduce((w, d) => Math.max(w, (d.boundingBox?.width ?? 0) / video.videoWidth), 0);
    }
    return { hands, body: this.body, faceWidth: this.faceWidth };
  }
}

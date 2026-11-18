import { CROP_ASPECT, cropFor, easeCrop, gainFor, toFrame } from "./roi.js";
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
    const hands = await make(HandLandmarker, "hand_landmarker.task", {
      numHands: 2,
      // Lower than the defaults so that small, far-away hands are still picked up.
      minHandDetectionConfidence: 0.3,
      minHandPresenceConfidence: 0.3,
      minTrackingConfidence: 0.3,
    });
    const faces = await make(FaceDetector, "blaze_face_short_range.tflite", { minDetectionConfidence: 0.5 });
    // The body only drives the cartoon avatar; the game still works without it.
    const pose = await make(PoseLandmarker, "pose_landmarker_lite.task", {
      numPoses: 1,
      minPoseDetectionConfidence: 0.3,
      minPosePresenceConfidence: 0.3,
      minTrackingConfidence: 0.3,
    }).catch((e) => {
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
    this.cropAt = 0;
    this.crop = null; // box of the video the hand model looks at; null = the whole frame
    this.canvas = document.createElement("canvas"); // the cropped (and brightened) frame
    this.canvas.height = 576;
    this.canvas.width = Math.round(576 * CROP_ASPECT);
    this.ctx = this.canvas.getContext("2d");
    this.sampler = document.createElement("canvas"); // tiny copy of the frame to measure how dark the room is
    this.sampler.width = 32;
    this.sampler.height = 24;
    this.sctx = this.sampler.getContext("2d", { willReadFrequently: true });
    this.gain = 1;
    this.lastSampleAt = 0;
    this.body = null; // 33 pose landmarks of the closest person, or null
    this.lastVideoTime = -1;
    this.lastFaceAt = 0;
    this.faceWidth = 0; // widest face as a fraction of the frame width; 0 = none
  }

  /** Returns {hands: [{image, world}], body, faceWidth} or null if the video has no new frame. */
  process(video, nowMs) {
    if (video.readyState < 2 || video.currentTime === this.lastVideoTime) return null;
    this.lastVideoTime = video.currentTime;

    if (this.pose && nowMs - this.lastPoseAt > 66) {
      // ~15 poses per second is plenty for an avatar and leaves time for the hands.
      this.lastPoseAt = nowMs;
      this.body = this.pose.detectForVideo(video, nowMs).landmarks[0] ?? null;
      const crop = cropFor(this.body, video.videoWidth, video.videoHeight);
      if (crop) {
        this.crop = easeCrop(this.crop, crop);
        this.cropAt = nowMs;
      } else if (nowMs - this.cropAt > 1000) this.crop = null; // a missed pose must not make the hand model jump to the whole frame
    }

    const hands = this.detectHands(video, nowMs);

    if (nowMs - this.lastFaceAt > 200) {
      // Faces change slowly; checking ~5x/s keeps the frame rate for hand tracking.
      this.lastFaceAt = nowMs;
      const faces = this.faces.detectForVideo(video, nowMs).detections;
      this.faceWidth = faces.reduce((w, d) => Math.max(w, (d.boundingBox?.width ?? 0) / video.videoWidth), 0);
    }
    return { hands, body: this.body, faceWidth: this.faceWidth };
  }

  /** Hands in whole-frame coordinates, found in the crop around the pupil (or the whole frame when there is none). */
  detectHands(video, nowMs) {
    const { videoWidth: vw, videoHeight: vh } = video;
    if (!this.crop || !this.ctx) {
      const res = this.hands.detectForVideo(video, nowMs);
      return res.landmarks.map((image, i) => ({ image, world: res.worldLandmarks[i] }));
    }
    if (nowMs - this.lastSampleAt > 500) {
      this.lastSampleAt = nowMs;
      this.sctx.drawImage(video, this.crop.x, this.crop.y, this.crop.w, this.crop.h, 0, 0, 32, 24);
      const px = this.sctx.getImageData(0, 0, 32, 24).data;
      let sum = 0;
      for (let i = 0; i < px.length; i += 4) sum += (px[i] + px[i + 1] + px[i + 2]) / 3;
      this.gain = gainFor(sum / (px.length / 4));
    }
    const { x, y, w, h } = this.crop;
    this.ctx.filter = this.gain > 1.05 ? `brightness(${this.gain.toFixed(2)})` : "none"; // dim classrooms
    this.ctx.drawImage(video, x, y, w, h, 0, 0, this.canvas.width, this.canvas.height);
    const res = this.hands.detectForVideo(this.canvas, nowMs);
    return res.landmarks.map((image, i) => ({ image: toFrame(image, this.crop, vw, vh), world: res.worldLandmarks[i] }));
  }
}

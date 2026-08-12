const TIP = { thumb: 4, index: 8, middle: 12, ring: 16, pinky: 20 };
const PIP = { thumb: 3, index: 6, middle: 10, ring: 14, pinky: 18 };
const DIP = { thumb: 2, index: 7, middle: 11, ring: 15, pinky: 19 };
const MCP = { thumb: 2, index: 5, middle: 9, ring: 13, pinky: 17 };

const ENTER_SCORE = 0.73;
const EXIT_SCORE = 0.46;
const CONFIRM_MS = 300;
const RELEASE_MS = 210;
const LOST_GRACE_MS = 220;
const COOLDOWN_MS = 380;
const MAX_JITTER = 0.085;

class OneEuro {
  constructor(minCutoff = 1.15, beta = 0.012, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.x = null;
    this.dx = 0;
    this.t = null;
  }
  filter(x, t) {
    if (this.x == null) {
      this.x = x;
      this.t = t;
      return x;
    }
    const dt = Math.max((t - this.t) / 1000, 1e-4);
    const dx = (x - this.x) / dt;
    this.dx = this.smooth(dx, this.dx, this.alpha(dt, this.dCutoff));
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x = this.smooth(x, this.x, this.alpha(dt, cutoff));
    this.t = t;
    return this.x;
  }
  alpha(dt, cutoff) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }
  smooth(x, prev, a) {
    return a * x + (1 - a) * prev;
  }
  reset() {
    this.x = null;
    this.dx = 0;
    this.t = null;
  }
}

class LandmarkFilter {
  constructor() {
    this.filters = Array.from({ length: 21 }, () => [
      new OneEuro(),
      new OneEuro(),
      new OneEuro(0.8, 0.02),
    ]);
  }
  apply(landmarks, t) {
    return landmarks.map((p, i) => ({
      x: this.filters[i][0].filter(p.x, t),
      y: this.filters[i][1].filter(p.y, t),
      z: this.filters[i][2].filter(p.z ?? 0, t),
    }));
  }
  reset() {
    for (const f of this.filters) f.forEach((c) => c.reset());
  }
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function invLerp(v, a, b) {
  return clamp((v - a) / (b - a), 0, 1);
}
function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z || 0) - (b.z || 0);
  return Math.hypot(dx, dy, dz);
}
function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) };
}
function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function len(a) {
  return Math.hypot(a.x, a.y, a.z);
}
function norm(a) {
  const l = len(a) || 1e-6;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
}
function angle(a, b, c) {
  const v1 = sub(a, b);
  const v2 = sub(c, b);
  const d = clamp(dot(norm(v1), norm(v2)), -1, 1);
  return Math.acos(d);
}

function fingerStraight(lm, name) {
  const tip = lm[TIP[name]];
  const pip = lm[PIP[name]];
  const mcp = lm[MCP[name]];
  const dip = lm[DIP[name]];
  const a = angle(mcp, pip, dip);
  const b = angle(pip, dip, tip);
  const mean = (a + b) * 0.5;
  const straight = invLerp(mean, 0.7, 2.55);
  const reach = dist(tip, mcp) / (dist(pip, mcp) + 1e-6);
  const reachScore = invLerp(reach, 1.05, 1.85);
  return clamp(straight * 0.65 + reachScore * 0.35, 0, 1);
}

function inFrame(lm) {
  let ok = 0;
  for (const p of lm) {
    if (p.x > 0.03 && p.x < 0.97 && p.y > 0.02 && p.y < 0.98) ok++;
  }
  return ok / lm.length;
}

function palmInfo(lm, handedness) {
  const wrist = lm[0];
  const idx = lm[5];
  const pnk = lm[17];
  const mid = lm[9];
  const v1 = sub(idx, wrist);
  const v2 = sub(pnk, wrist);
  const crossZ = v1.x * v2.y - v1.y * v2.x;
  const n = {
    x: v1.y * v2.z - v1.z * v2.y,
    y: v1.z * v2.x - v1.x * v2.z,
    z: v1.x * v2.y - v1.y * v2.x,
  };
  const nl = len(n) || 1e-6;
  n.x /= nl; n.y /= nl; n.z /= nl;

  const isRight = handedness === "Right";
  // Landmarks are X-flipped to match the mirrored selfie view, which negates 2D winding.
  const windingPalm = isRight ? crossZ < 0 : crossZ > 0;

  const knuckleZ = (lm[5].z + lm[9].z + lm[13].z + lm[17].z) * 0.25;
  const wristZ = wrist.z;
  const knucklesCloser = knuckleZ < wristZ - 0.008;

  let votes = 0;
  if (windingPalm) votes++;
  if (n.z < 0) votes++;
  if (!knucklesCloser) votes++;

  const thumb = lm[4];
  const thumbSide = isRight ? thumb.x > mid.x : thumb.x < mid.x;
  if (thumbSide) votes += 0.35;

  const facing = votes >= 1.7;
  const confidence = clamp(Math.abs(crossZ) * 8 + Math.abs(n.z), 0, 1);
  return { facing, confidence, votes, crossZ, nz: n.z };
}

function poseScore(lm) {
  const index = fingerStraight(lm, "index");
  const middle = fingerStraight(lm, "middle");
  const ring = fingerStraight(lm, "ring");
  const pinky = fingerStraight(lm, "pinky");
  const thumb = fingerStraight(lm, "thumb");

  const indexOk = invLerp(index, 0.38, 0.78);
  const pinkyOk = invLerp(pinky, 0.28, 0.72);
  const middleFold = 1 - invLerp(middle, 0.2, 0.62);
  const ringFold = 1 - invLerp(ring, 0.2, 0.62);

  const spread = Math.abs(lm[8].x - lm[20].x);
  const spreadOk = invLerp(spread, 0.03, 0.11);
  const tipsFolded =
    0.5 * (lm[12].y > lm[9].y - 0.015 ? 1 : 0.4) +
    0.5 * (lm[16].y > lm[13].y - 0.015 ? 1 : 0.4);

  const shooter = indexOk * 0.55 + pinkyOk * 0.45;
  const fold = middleFold * 0.5 + ringFold * 0.5;
  let score = shooter * 0.5 + fold * 0.42 + spreadOk * 0.04 + tipsFolded * 0.04;

  if (index < 0.36 || pinky < 0.24) score *= 0.42;
  if (middle > 0.66 || ring > 0.66) score *= 0.42;
  if (thumb > 0.55) score = Math.min(1, score + 0.03);

  const frame = inFrame(lm);
  score *= invLerp(frame, 0.72, 0.94);

  return {
    score: clamp(score, 0, 1),
    index,
    middle,
    ring,
    pinky,
    thumb,
    frame,
  };
}

class GestureLock {
  constructor(id) {
    this.id = id;
    this.state = "IDLE";
    this.score = 0;
    this.charge = 0;
    this.type = "grapple";
    this.palmFacing = false;
    this.lockedType = null;
    this.confirmStart = 0;
    this.releaseStart = 0;
    this.lostStart = 0;
    this.cooldownUntil = 0;
    this.justLocked = false;
    this.justReleased = false;
    this.lastWrist = null;
    this.jitter = 0;
    this.holdMs = 0;
    this.lastT = 0;
    this.fingers = null;
  }

  update(sample, t) {
    this.justLocked = false;
    this.justReleased = false;
    const dt = this.lastT ? t - this.lastT : 16;
    this.lastT = t;

    if (!sample) {
      if (this.state === "HOLD" || this.state === "CHARGE") {
        if (!this.lostStart) this.lostStart = t;
        if (t - this.lostStart > LOST_GRACE_MS) {
          if (this.state === "HOLD") this._release(t);
          else this._idle();
        }
      } else if (this.state !== "COOLDOWN") {
        this._idle();
      }
      if (this.state === "COOLDOWN" && t >= this.cooldownUntil) this._idle();
      return this.snapshot();
    }

    this.lostStart = 0;
    this.score = sample.fingers.score;
    this.fingers = sample.fingers;
    this.palmFacing = sample.palm.facing;
    if (this.state !== "HOLD") {
      this.type = sample.palm.facing ? "impact" : "grapple";
    }

    if (this.lastWrist) {
      const j = Math.hypot(sample.wrist.x - this.lastWrist.x, sample.wrist.y - this.lastWrist.y);
      this.jitter = this.jitter * 0.72 + j * 0.28;
    }
    this.lastWrist = { x: sample.wrist.x, y: sample.wrist.y };

    if (this.state === "COOLDOWN") {
      if (t >= this.cooldownUntil && this.score < EXIT_SCORE) this._idle();
      return this.snapshot();
    }

    const stable = this.jitter < MAX_JITTER;
    const enter = this.score >= ENTER_SCORE && stable && sample.fingers.frame > 0.82;
    const stay = this.score >= EXIT_SCORE;

    if (this.state === "IDLE") {
      if (enter) {
        this.state = "CHARGE";
        this.confirmStart = t;
        this.charge = 0.05;
      }
    } else if (this.state === "CHARGE") {
      if (!enter) {
        if (!stay || !stable) {
          this.charge = Math.max(0, this.charge - dt / 180);
          if (this.charge <= 0 || this.score < EXIT_SCORE * 0.85) this._idle();
        }
      } else {
        const elapsed = t - this.confirmStart;
        this.charge = clamp(elapsed / CONFIRM_MS, 0, 1);
        if (this.charge >= 1) {
          this.state = "HOLD";
          this.lockedType = this.type;
          this.justLocked = true;
          this.holdMs = 0;
          this.charge = 1;
        }
      }
    } else if (this.state === "HOLD") {
      this.holdMs += dt;
      this.type = this.lockedType || this.type;
      if (!stay) {
        if (!this.releaseStart) this.releaseStart = t;
        if (t - this.releaseStart >= RELEASE_MS) this._release(t);
      } else {
        this.releaseStart = 0;
      }
    }

    return this.snapshot();
  }

  _release(t) {
    this.justReleased = this.state === "HOLD";
    this.state = "COOLDOWN";
    this.cooldownUntil = t + COOLDOWN_MS;
    this.charge = 0;
    this.lockedType = null;
    this.releaseStart = 0;
  }

  _idle() {
    this.state = "IDLE";
    this.charge = 0;
    this.confirmStart = 0;
    this.releaseStart = 0;
    this.lockedType = null;
  }

  snapshot() {
    return {
      id: this.id,
      state: this.state,
      score: this.score,
      charge: this.charge,
      type: this.type,
      palmFacing: this.palmFacing,
      justLocked: this.justLocked,
      justReleased: this.justReleased,
      jitter: this.jitter,
      holdMs: this.holdMs,
      fingers: this.fingers,
    };
  }
}

export class HandTracker {
  constructor() {
    this.landmarker = null;
    this.video = null;
    this.lastVideoTime = -1;
    this.filters = { Left: new LandmarkFilter(), Right: new LandmarkFilter() };
    this.locks = { Left: new GestureLock("Left"), Right: new GestureLock("Right") };
    this.hands = [];
    this.lastResult = null;
    this.fps = 0;
    this._frames = 0;
    this._fpsT = 0;
    this.ready = false;
    this.error = null;
  }

  async init(video) {
    this.video = video;
    const urls = [
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm",
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14",
    ];
    let FilesetResolver;
    let HandLandmarker;
    let lastErr;
    for (const url of urls) {
      try {
        const vision = await import(url);
        FilesetResolver = vision.FilesetResolver || vision.default?.FilesetResolver;
        HandLandmarker = vision.HandLandmarker || vision.default?.HandLandmarker;
        if (FilesetResolver && HandLandmarker) break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (!FilesetResolver || !HandLandmarker) {
      throw lastErr || new Error("MediaPipe tasks-vision failed to load");
    }
    const files = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );
    const model =
      "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
    try {
      this.landmarker = await HandLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: model, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.62,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
      });
    } catch (_) {
      this.landmarker = await HandLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: model, delegate: "CPU" },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.62,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
      });
    }
    this.ready = true;
  }

  async startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
      audio: false,
    });
    this.video.srcObject = stream;
    await this.video.play();
    return stream;
  }

  update(now) {
    this.hands = [];
    if (!this.ready || !this.video || this.video.readyState < 2) {
      this.locks.Left.update(null, now);
      this.locks.Right.update(null, now);
      return this.hands;
    }

    let result = this.lastResult;
    if (this.video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.video.currentTime;
      result = this.landmarker.detectForVideo(this.video, now);
      this.lastResult = result;
      this._frames++;
    }
    if (now - this._fpsT > 1000) {
      this.fps = this._frames;
      this._frames = 0;
      this._fpsT = now;
    }

    const seen = new Set();
    const lms = result?.landmarks || [];
    const handed = result?.handednesses || result?.handedness || [];

    for (let i = 0; i < lms.length; i++) {
      const rawLabel = handed[i]?.[0]?.categoryName || handed[i]?.categoryName || "Right";
      const label = rawLabel === "Left" || rawLabel === "Right" ? rawLabel : "Right";
      seen.add(label);
      const flipped = lms[i].map((p) => ({ x: 1 - p.x, y: p.y, z: p.z || 0 }));
      const smooth = this.filters[label].apply(flipped, now);
      const fingers = poseScore(smooth);
      const palm = palmInfo(smooth, label);
      const wrist = smooth[0];
      const palmPt = {
        x: (smooth[0].x + smooth[5].x + smooth[17].x) / 3,
        y: (smooth[0].y + smooth[5].y + smooth[17].y) / 3,
        z: (smooth[0].z + smooth[9].z) / 2,
      };
      const gesture = this.locks[label].update({ fingers, palm, wrist }, now);
      const size = dist(smooth[0], smooth[9]);
      this.hands.push({
        id: label,
        rawId: rawLabel,
        landmarks: smooth,
        wrist,
        palm: palmPt,
        size,
        gesture,
        palmFacing: palm.facing,
      });
    }

    for (const side of ["Left", "Right"]) {
      if (!seen.has(side)) {
        this.filters[side].reset();
        const gesture = this.locks[side].update(null, now);
        if (gesture.state === "HOLD" || gesture.state === "COOLDOWN") {
          // keep a ghost so the game can finish a release
          this.hands.push({
            id: side,
            landmarks: null,
            wrist: null,
            palm: null,
            size: 0,
            gesture,
            lost: true,
            palmFacing: false,
          });
        }
      }
    }

    return this.hands;
  }

  drawOverlay(canvas, hands) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const pairs = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [0, 9], [9, 10], [10, 11], [11, 12],
      [0, 13], [13, 14], [14, 15], [15, 16],
      [0, 17], [17, 18], [18, 19], [19, 20],
      [5, 9], [9, 13], [13, 17],
    ];

    for (const hand of hands) {
      if (!hand.landmarks) continue;
      const g = hand.gesture;
      const locked = g.state === "HOLD";
      const charging = g.state === "CHARGE";
      ctx.lineWidth = locked ? 3 : 2;
      ctx.strokeStyle = locked ? "rgba(240,193,75,0.95)" : charging ? "rgba(110,243,255,0.85)" : "rgba(180,210,255,0.45)";
      ctx.beginPath();
      for (const [a, b] of pairs) {
        const p = hand.landmarks[a];
        const q = hand.landmarks[b];
        ctx.moveTo(p.x * w, p.y * h);
        ctx.lineTo(q.x * w, q.y * h);
      }
      ctx.stroke();

      for (let i = 0; i < hand.landmarks.length; i++) {
        const p = hand.landmarks[i];
        const ext = [4, 8, 12, 16, 20].includes(i);
        const shooter = i === 8 || i === 20;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, shooter ? 5.5 : ext ? 4 : 2.4, 0, Math.PI * 2);
        if (shooter && (locked || charging)) ctx.fillStyle = "#f0c14b";
        else if (i === 12 || i === 16) ctx.fillStyle = locked ? "#e8363a" : "rgba(232,54,58,0.7)";
        else ctx.fillStyle = "rgba(110,243,255,0.9)";
        ctx.fill();
      }

      const palm = hand.palm;
      ctx.font = "11px Share Tech Mono, monospace";
      ctx.fillStyle = "#f0c14b";
      ctx.fillText(
        `${hand.id[0]} ${g.state} ${(g.score * 100) | 0}% ${g.type.toUpperCase()}`,
        palm.x * w - 40,
        palm.y * h - 16
      );
    }
  }
}

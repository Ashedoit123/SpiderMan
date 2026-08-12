// Robust, High-Accuracy Hand Tracker with Persistent Hand-Isolation & Anti-Glitch Lock

class OneEuroFilter {
  constructor(minCutoff = 1.0, beta = 0.02) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.xPrev = null;
    this.dxPrev = 0;
    this.lastTime = null;
  }

  filter(val, timestamp) {
    if (this.xPrev === null || this.lastTime === null) {
      this.xPrev = val;
      this.lastTime = timestamp;
      return val;
    }

    const dt = Math.max(0.001, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;

    const dx = (val - this.xPrev) / dt;
    const edx = this.dxPrev + 0.1 * (dx - this.dxPrev);
    this.dxPrev = edx;

    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    const alpha = (2 * Math.PI * cutoff * dt) / (2 * Math.PI * cutoff * dt + 1);

    const x = this.xPrev + alpha * (val - this.xPrev);
    this.xPrev = x;
    return x;
  }

  reset() {
    this.xPrev = null;
    this.dxPrev = 0;
    this.lastTime = null;
  }
}

export class HandTracker {
  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.hands = null;
    this.isReady = false;
    this.isRunning = false;

    // Completely isolated persistent hands (tracked by Handedness label)
    this.handStates = {
      Right: this.createHandState('Right'),
      Left: this.createHandState('Left')
    };

    // Isolated filters per hand
    this.filters = {
      Right: { x: new OneEuroFilter(1.0, 0.04), y: new OneEuroFilter(1.0, 0.04) },
      Left: { x: new OneEuroFilter(1.0, 0.04), y: new OneEuroFilter(1.0, 0.04) }
    };

    // Isolated callbacks
    this.onShootWeb = null;     // (handKey, { origin, aim })
    this.onFistGrab = null;     // (handKey, { wristPos })
    this.onFistRelease = null;  // (handKey)
  }

  createHandState(handKey) {
    return {
      handKey,               // 'Left' or 'Right'
      detected: false,
      landmarks: null,
      gesture: 'NONE',       // 'SPIDERMAN', 'FIST', 'OPEN', 'NONE'
      prevGesture: 'NONE',

      // Anti-glitch stabilization counters
      spidermanStreak: 0,
      fistStreak: 0,
      nonSpidermanStreak: 10,
      
      // Strict trigger lock: 1 shot per intentional 🤟 gesture
      isArmed: true,
      lastShotTime: 0,
      isHoldingFist: false,

      wristScreen: { x: handKey === 'Right' ? 0.7 : 0.3, y: 0.85 },
      aimScreen: { x: handKey === 'Right' ? 0.7 : 0.3, y: 0.5 },
      
      fingerDebug: {
        thumb: false,
        index: false,
        middle: false,
        ring: false,
        pinky: false
      }
    };
  }

  async init() {
    try {
      let HandsClass = window.Hands;
      if (!HandsClass) {
        try {
          const mpHands = await import('@mediapipe/hands');
          HandsClass = mpHands.Hands || (mpHands.default && mpHands.default.Hands) || mpHands.default;
        } catch (e) {
          console.warn('Importing @mediapipe/hands failed, using window fallback:', e);
        }
      }

      if (!HandsClass && window.Hands) {
        HandsClass = window.Hands;
      }

      if (!HandsClass) {
        throw new Error('MediaPipe Hands constructor unavailable');
      }

      this.hands = new HandsClass({
        locateFile: (file) => `/mediapipe/hands/${file}`
      });

      this.hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.65
      });

      this.hands.onResults((results) => this.processResults(results));
      this.isReady = true;
      return true;
    } catch (err) {
      console.warn('Local MediaPipe init failed, trying CDN fallback...', err);
      try {
        const mpHands = await import('@mediapipe/hands');
        const HandsClass = mpHands.Hands || (mpHands.default && mpHands.default.Hands) || mpHands.default || window.Hands;
        this.hands = new HandsClass({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
        });
        this.hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.65
        });
        this.hands.onResults((results) => this.processResults(results));
        this.isReady = true;
        return true;
      } catch (cdnErr) {
        console.error('MediaPipe Hands initialization failed:', cdnErr);
        return false;
      }
    }
  }

  async startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera not supported');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      },
      audio: false
    });

    this.video.srcObject = stream;
    await new Promise((resolve) => {
      this.video.onloadedmetadata = () => {
        this.video.play();
        resolve();
      };
    });

    this.isRunning = true;
    this.cameraLoop();
  }

  stopCamera() {
    this.isRunning = false;
    if (this.video && this.video.srcObject) {
      this.video.srcObject.getTracks().forEach(t => t.stop());
      this.video.srcObject = null;
    }
  }

  async cameraLoop() {
    if (!this.isRunning) return;

    if (this.video && this.video.readyState >= 2 && this.video.videoWidth > 0 && this.hands) {
      try {
        await this.hands.send({ image: this.video });
      } catch (e) {
        // Safe frame drop
      }
    }

    if (this.isRunning) {
      requestAnimationFrame(() => this.cameraLoop());
    }
  }

  dist3D(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = (p1.z || 0) - (p2.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  processResults(results) {
    const now = performance.now();

    // Mark all hands as undetected for this frame initially
    const activeHandKeys = new Set();

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const rawLM = results.multiHandLandmarks[i];
        
        // MediaPipe in selfie camera: 'Left' detected handedness is the player's Right hand on screen
        const rawLabel = results.multiHandedness && results.multiHandedness[i] 
          ? results.multiHandedness[i].label 
          : (i === 0 ? 'Right' : 'Left');
        
        const handKey = rawLabel === 'Left' ? 'Right' : 'Left'; // Mirror mapping
        activeHandKeys.add(handKey);

        const state = this.handStates[handKey];
        state.detected = true;

        // Mirror coordinates for natural selfie view
        const lm = rawLM.map(p => ({
          x: 1.0 - p.x,
          y: p.y,
          z: p.z
        }));
        state.landmarks = lm;

        const wrist = lm[0];
        const indexMCP = lm[5];
        const indexPIP = lm[6];
        const indexTip = lm[8];

        const middleMCP = lm[9];
        const middlePIP = lm[10];
        const middleTip = lm[12];

        const ringMCP = lm[13];
        const ringPIP = lm[14];
        const ringTip = lm[16];

        const pinkyMCP = lm[17];
        const pinkyPIP = lm[18];
        const pinkyTip = lm[20];

        const thumbMCP = lm[2];
        const thumbTip = lm[4];

        // Reference Palm Size: Distance from wrist to middle knuckle (scale invariant)
        const palmSize = Math.max(0.04, this.dist3D(wrist, middleMCP));
        const palmCenter = {
          x: (wrist.x + indexMCP.x + middleMCP.x + ringMCP.x + pinkyMCP.x) / 5,
          y: (wrist.y + indexMCP.y + middleMCP.y + ringMCP.y + pinkyMCP.y) / 5,
          z: (wrist.z + indexMCP.z + middleMCP.z + ringMCP.z + pinkyMCP.z) / 5
        };

        // --- 1. STRICT ANATOMICAL SPIDER-MAN GESTURE DETECTION (🤟) ---

        // Middle Finger: MUST be firmly folded into palm
        const middleDistMCP = this.dist3D(middleTip, middleMCP);
        const middleDistCenter = this.dist3D(middleTip, palmCenter);
        const middleDistWrist = this.dist3D(middleTip, wrist);
        const middlePIPDistWrist = this.dist3D(middlePIP, wrist);
        const isMiddleCurled = (middleDistMCP < palmSize * 0.55) || (middleDistCenter < palmSize * 0.48) || (middleDistWrist < middlePIPDistWrist * 0.95);

        // Ring Finger: MUST be firmly folded into palm
        const ringDistMCP = this.dist3D(ringTip, ringMCP);
        const ringDistCenter = this.dist3D(ringTip, palmCenter);
        const ringDistWrist = this.dist3D(ringTip, wrist);
        const ringPIPDistWrist = this.dist3D(ringPIP, wrist);
        const isRingCurled = (ringDistMCP < palmSize * 0.55) || (ringDistCenter < palmSize * 0.48) || (ringDistWrist < ringPIPDistWrist * 0.95);

        // Index Finger: MUST be extended straight
        const indexDistMCP = this.dist3D(indexTip, indexMCP);
        const indexDistWrist = this.dist3D(indexTip, wrist);
        const indexPIPDistWrist = this.dist3D(indexPIP, wrist);
        const isIndexExtended = (indexDistMCP > palmSize * 0.75) && (indexDistWrist > indexPIPDistWrist * 1.15);

        // Pinky Finger: MUST be extended straight
        const pinkyDistMCP = this.dist3D(pinkyTip, pinkyMCP);
        const pinkyDistWrist = this.dist3D(pinkyTip, wrist);
        const pinkyPIPDistWrist = this.dist3D(pinkyPIP, wrist);
        const isPinkyExtended = (pinkyDistMCP > palmSize * 0.65) && (pinkyDistWrist > pinkyPIPDistWrist * 1.15);

        // Thumb: MUST be extended out / not tucked inside curled fingers
        const thumbDistCenter = this.dist3D(thumbTip, palmCenter);
        const isThumbExtended = thumbDistCenter > palmSize * 0.45;

        // Fist check: Index, Middle, Ring, Pinky are ALL curled into palm
        const isIndexCurled = !isIndexExtended && (this.dist3D(indexTip, indexMCP) < palmSize * 0.58);
        const isPinkyCurled = !isPinkyExtended && (this.dist3D(pinkyTip, pinkyMCP) < palmSize * 0.58);
        const isFistGesture = isIndexCurled && isMiddleCurled && isRingCurled && isPinkyCurled;

        // Strict Spider-Man Check (🤟)
        const isSpidermanGesture = isIndexExtended && isPinkyExtended && isMiddleCurled && isRingCurled && isThumbExtended;

        state.fingerDebug = {
          thumb: isThumbExtended,
          index: isIndexExtended,
          middle: isMiddleCurled,
          ring: isRingCurled,
          pinky: isPinkyExtended
        };

        // --- 2. ACCURATE SCREEN AIMING PROJECTION ---
        state.wristScreen = {
          x: wrist.x * 0.75 + middleMCP.x * 0.25,
          y: wrist.y * 0.75 + middleMCP.y * 0.25
        };

        // Aiming vector from wrist through knuckles
        const dirX = middleMCP.x - wrist.x;
        const dirY = middleMCP.y - wrist.y;
        const dirLen = Math.sqrt(dirX * dirX + dirY * dirY) || 0.001;

        // Natural screen-space projection
        const projectionLen = palmSize * 3.5;
        const rawAimX = Math.max(0.02, Math.min(0.98, state.wristScreen.x + (dirX / dirLen) * projectionLen));
        const rawAimY = Math.max(0.02, Math.min(0.98, state.wristScreen.y + (dirY / dirLen) * projectionLen));

        // Filter aim with One-Euro adaptive filter
        state.aimScreen.x = this.filters[handKey].x.filter(rawAimX, now);
        state.aimScreen.y = this.filters[handKey].y.filter(rawAimY, now);

        // --- 3. ANTI-GLITCH TRIGGER LOCK & ISOLATED STATE MACHINE ---
        state.prevGesture = state.gesture;

        if (isSpidermanGesture) {
          state.spidermanStreak++;
          state.fistStreak = 0;
          state.nonSpidermanStreak = 0;
        } else if (isFistGesture) {
          state.fistStreak++;
          state.spidermanStreak = 0;
          state.nonSpidermanStreak++;
        } else {
          state.spidermanStreak = 0;
          state.fistStreak = 0;
          state.nonSpidermanStreak++;
        }

        // Re-arm shooting ONLY after holding a non-Spider-Man gesture for at least 5 frames (0.15s)
        if (state.nonSpidermanStreak >= 5 && !state.isArmed) {
          state.isArmed = true;
        }

        // Trigger Spider-Man Web Blast (🤟)
        // Requires 3 consecutive confirmed frames + must be armed + cooldown (450ms)
        if (state.spidermanStreak >= 3) {
          state.gesture = 'SPIDERMAN';

          if (state.isArmed && (now - state.lastShotTime > 450)) {
            state.isArmed = false; // Lock out until hand resets!
            state.lastShotTime = now;

            if (this.onShootWeb) {
              this.onShootWeb(handKey, {
                origin: { ...state.wristScreen },
                aim: { ...state.aimScreen }
              });
            }
          }
        } else if (state.fistStreak >= 2) {
          state.gesture = 'FIST';

          if (!state.isHoldingFist) {
            state.isHoldingFist = true;
            if (this.onFistGrab) {
              this.onFistGrab(handKey, { wristPos: { ...state.wristScreen } });
            }
          }
        } else {
          state.gesture = 'OPEN';

          if (state.isHoldingFist) {
            state.isHoldingFist = false;
            if (this.onFistRelease) {
              this.onFistRelease(handKey);
            }
          }
        }
      }
    }

    // Handle hands that disappeared from view
    ['Right', 'Left'].forEach(handKey => {
      if (!activeHandKeys.has(handKey)) {
        const s = this.handStates[handKey];
        s.detected = false;
        s.spidermanStreak = 0;
        s.fistStreak = 0;
        s.nonSpidermanStreak++;
        if (s.nonSpidermanStreak >= 5) {
          s.isArmed = true; // Rearm if hand left camera
        }
        if (s.isHoldingFist) {
          s.isHoldingFist = false;
          if (this.onFistRelease) this.onFistRelease(handKey);
        }
        s.gesture = 'NONE';
        this.filters[handKey].x.reset();
        this.filters[handKey].y.reset();
      }
    });
  }

  // Draw isolated aiming reticle & web-shooters for active hands
  drawAimingHUD(ctx, width, height) {
    if (!ctx) return;

    ['Right', 'Left'].forEach(handKey => {
      const hand = this.handStates[handKey];
      if (!hand.detected) return;

      const wx = hand.wristScreen.x * width;
      const wy = hand.wristScreen.y * height;
      const ax = hand.aimScreen.x * width;
      const ay = hand.aimScreen.y * height;

      ctx.save();

      // Laser guide from wrist to aim reticle
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(ax, ay);
      ctx.strokeStyle = hand.gesture === 'SPIDERMAN' ? 'rgba(255, 23, 68, 0.9)' : 'rgba(0, 229, 255, 0.4)';
      ctx.lineWidth = hand.gesture === 'SPIDERMAN' ? 2.5 : 1.5;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Wrist Web Shooter Node
      ctx.beginPath();
      ctx.arc(wx, wy, 12, 0, Math.PI * 2);
      ctx.fillStyle = hand.gesture === 'SPIDERMAN' ? '#ff1744' : '#00e5ff';
      ctx.shadowColor = hand.gesture === 'SPIDERMAN' ? '#ff1744' : '#00e5ff';
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Aiming Reticle
      ctx.save();
      ctx.translate(ax, ay);
      const reticleColor = hand.gesture === 'SPIDERMAN' ? '#ffff00' : hand.gesture === 'FIST' ? '#ff1744' : '#00e5ff';
      ctx.strokeStyle = reticleColor;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = reticleColor;
      ctx.shadowBlur = 10;

      // Circle
      const r = 18;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();

      // Crosshair lines
      ctx.beginPath();
      ctx.moveTo(0, -r - 5); ctx.lineTo(0, -r + 2);
      ctx.moveTo(0, r - 2); ctx.lineTo(0, r + 5);
      ctx.moveTo(-r - 5, 0); ctx.lineTo(-r + 2, 0);
      ctx.moveTo(r - 2, 0); ctx.lineTo(r + 5, 0);
      ctx.stroke();

      // Center dot
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fillStyle = reticleColor;
      ctx.fill();

      // Hand & Gesture Tag
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = reticleColor;
      ctx.textAlign = 'center';
      const label = `${handKey.toUpperCase()}: ${hand.gesture === 'SPIDERMAN' ? 'THWIP! 🤟' : hand.gesture === 'FIST' ? 'GRAB ✊' : 'AIM'}`;
      ctx.fillText(label, 0, -r - 8);

      ctx.restore();
      ctx.restore();
    });
  }
}

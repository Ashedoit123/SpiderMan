import { movieAudioEngine } from './audioEngine.js';
import { HandTracker } from './handTracker.js';
import { MovieWebEngine } from './webEngine.js';

class SpiderManApp {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.video = document.getElementById('webcam-video');

    this.audio = movieAudioEngine;
    this.webEngine = new MovieWebEngine(this.audio);
    this.handTracker = new HandTracker(this.video, this.canvas);

    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.lastTime = performance.now();

    // Mouse fallback
    this.mouseState = {
      handKey: 'Mouse',
      detected: false,
      gesture: 'NONE',
      wristScreen: { x: 0.5, y: 0.88 },
      aimScreen: { x: 0.5, y: 0.5 }
    };

    this.init();
  }

  async init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Connect Hand Tracking with Hand Isolation
    this.handTracker.onShootWeb = (handKey, { origin, aim }) => {
      this.webEngine.shootWeb(origin, aim, handKey);
    };

    this.handTracker.onFistGrab = (handKey, { wristPos }) => {
      this.webEngine.tryGrabWeb(handKey, wristPos);
    };

    this.handTracker.onFistRelease = (handKey) => {
      this.webEngine.releaseWeb(handKey);
    };

    this.setupUI();
    this.setupMouse();

    // Start loop
    requestAnimationFrame((t) => this.render(t));
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  setupUI() {
    // Suit skin selector
    document.querySelectorAll('.suit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.audio.ensureContext();
        document.querySelectorAll('.suit-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.webEngine.setStyle(btn.dataset.suit);
      });
    });

    // Clear webs
    document.getElementById('btn-clear').addEventListener('click', () => {
      this.webEngine.clear();
    });

    // Sound toggle
    const btnSound = document.getElementById('btn-sound');
    btnSound.addEventListener('click', () => {
      this.audio.ensureContext();
      const muted = this.audio.toggleMute();
      btnSound.innerText = muted ? '🔇' : '🔊';
    });

    // Camera toggle
    const btnCam = document.getElementById('btn-cam-view');
    let camMode = 'ar';
    btnCam.addEventListener('click', () => {
      camMode = camMode === 'ar' ? 'skyline' : 'ar';
      btnCam.innerText = camMode === 'ar' ? '📹 AR View' : '🌃 Skyline';
      this.video.classList.toggle('hidden', camMode === 'skyline');
    });

    // Start camera modal
    const modal = document.getElementById('welcome-modal');
    document.getElementById('btn-start-camera').addEventListener('click', async () => {
      this.audio.ensureContext();
      try {
        await this.handTracker.init();
        await this.handTracker.startCamera();
        modal.classList.add('hidden');
      } catch (err) {
        alert('Could not access camera: ' + err.message + '. You can still aim and shoot with mouse!');
        modal.classList.add('hidden');
      }
    });

    document.getElementById('btn-mouse-mode').addEventListener('click', () => {
      this.audio.ensureContext();
      modal.classList.add('hidden');
    });
  }

  setupMouse() {
    let isMouseDown = false;

    this.canvas.addEventListener('pointerdown', (e) => {
      this.audio.ensureContext();
      isMouseDown = true;

      const rect = this.canvas.getBoundingClientRect();
      const aimX = (e.clientX - rect.left) / this.width;
      const aimY = (e.clientY - rect.top) / this.height;
      const origin = { x: aimX > 0.5 ? 0.75 : 0.25, y: 0.9 };

      this.mouseState.detected = true;
      this.mouseState.wristScreen = origin;
      this.mouseState.aimScreen = { x: aimX, y: aimY };

      if (e.button === 2) {
        // Right click: Fist grab
        this.mouseState.gesture = 'FIST';
        this.webEngine.tryGrabWeb('Mouse', origin);
      } else {
        // Left click: Shoot web
        this.mouseState.gesture = 'SPIDERMAN';
        this.webEngine.shootWeb(origin, { x: aimX, y: aimY }, 'Mouse');
      }
    });

    this.canvas.addEventListener('pointermove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const aimX = (e.clientX - rect.left) / this.width;
      const aimY = (e.clientY - rect.top) / this.height;
      this.mouseState.aimScreen = { x: aimX, y: aimY };

      if (isMouseDown && this.mouseState.gesture === 'FIST') {
        this.mouseState.wristScreen = { x: aimX, y: Math.max(aimY + 0.1, 0.7) };
      }
    });

    const onPointerUp = () => {
      if (isMouseDown) {
        isMouseDown = false;
        if (this.mouseState.gesture === 'FIST') {
          this.webEngine.releaseWeb('Mouse');
        }
        this.mouseState.gesture = 'NONE';
        this.mouseState.detected = false;
      }
    };

    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  updateHUD(handDict) {
    const statusText = document.getElementById('hud-status');
    const right = handDict['Right'];
    const left = handDict['Left'];
    const primary = (right && right.detected) ? right : (left && left.detected) ? left : (this.mouseState.detected ? this.mouseState : null);

    if (primary) {
      if (primary.gesture === 'SPIDERMAN') {
        statusText.innerText = `🤟 [${primary.handKey ? primary.handKey.toUpperCase() : 'HAND'}] THWIP! WEB FIRED!`;
        statusText.style.color = '#ffff00';
      } else if (primary.gesture === 'FIST') {
        statusText.innerText = `✊ [${primary.handKey ? primary.handKey.toUpperCase() : 'HAND'}] FIST LOCKED! PULLING WEB!`;
        statusText.style.color = '#00e5ff';
      } else {
        statusText.innerText = `🎯 AIMING AT SCREEN (MAKE 🤟 TO SHOOT, ✊ WITHIN 2s TO GRAB)`;
        statusText.style.color = '#ffffff';
      }

      if (primary.fingerDebug) {
        const d = primary.fingerDebug;
        document.getElementById('f-thumb').className = `f-tag ${d.thumb ? 'on' : ''}`;
        document.getElementById('f-index').className = `f-tag ${d.index ? 'on' : ''}`;
        document.getElementById('f-middle').className = `f-tag ${d.middle ? 'curled' : 'open'}`;
        document.getElementById('f-ring').className = `f-tag ${d.ring ? 'curled' : 'open'}`;
        document.getElementById('f-pinky').className = `f-tag ${d.pinky ? 'on' : ''}`;
      }
    } else {
      statusText.innerText = 'SHOW HAND TO CAMERA (🤟 TO SHOOT, ✊ WITHIN 2s TO GRAB)';
      statusText.style.color = '#ffd700';
      ['f-thumb', 'f-index', 'f-middle', 'f-ring', 'f-pinky'].forEach(id => {
        document.getElementById(id).className = 'f-tag';
      });
    }
  }

  drawSkyline(ctx, width, height) {
    ctx.save();
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#0a0d1a');
    grad.addColorStop(0.6, '#141829');
    grad.addColorStop(1, '#231526');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#ffffe0';
    ctx.beginPath();
    ctx.arc(width * 0.85, height * 0.2, 35, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0a0d18';
    const bldgs = [
      { x: 0, w: 0.15, h: 0.45 },
      { x: 0.14, w: 0.18, h: 0.6 },
      { x: 0.31, w: 0.2, h: 0.4 },
      { x: 0.5, w: 0.16, h: 0.55 },
      { x: 0.65, w: 0.2, h: 0.48 },
      { x: 0.84, w: 0.18, h: 0.65 }
    ];
    bldgs.forEach(b => {
      ctx.fillRect(b.x * width, height * (1 - b.h), b.w * width, height * b.h);
    });

    ctx.restore();
  }

  render(time) {
    const dt = Math.min(0.08, (time - this.lastTime) / 1000);
    this.lastTime = time;

    const handDict = { ...this.handTracker.handStates };
    if (this.mouseState.detected) {
      handDict['Mouse'] = this.mouseState;
    }

    // 1. Update Physics with Hand Isolation
    this.webEngine.update(dt, handDict);

    // 2. Render
    this.ctx.clearRect(0, 0, this.width, this.height);

    if (this.video.classList.contains('hidden')) {
      this.drawSkyline(this.ctx, this.width, this.height);
    }

    // Draw Webs, Splats, and Grab Timer countdowns
    this.webEngine.draw(this.ctx, this.width, this.height);

    // Draw Isolated Aiming Crosshairs & Web-Shooter HUD
    this.handTracker.drawAimingHUD(this.ctx, this.width, this.height);

    // 3. Update HUD Feedback
    this.updateHUD(handDict);

    requestAnimationFrame((t) => this.render(t));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new SpiderManApp();
});

// Visual Effects: Comic Sound Popups, Spider-Sense Tingling, Camera Shake & NYC Backdrop

export class VisualEffects {
  constructor() {
    this.comicPopups = [];
    this.spiderSenseActive = false;
    this.spiderSenseIntensity = 0;
    this.spiderSenseTimer = 0;
    this.screenShake = 0;
    this.clouds = [
      { x: 0.1, y: 0.15, speed: 0.008, scale: 1.2 },
      { x: 0.5, y: 0.22, speed: 0.012, scale: 0.8 },
      { x: 0.8, y: 0.12, speed: 0.006, scale: 1.5 }
    ];
    this.searchlights = [
      { angle: -0.4, speed: 0.8, x: 0.25 },
      { angle: 0.3, speed: -0.6, x: 0.75 }
    ];
  }

  // Trigger Comic Text popup like "THWIP!", "KAPOW!", "SPLAT!"
  addComicText(text, x, y, options = {}) {
    const colors = [
      { fill: '#ffe600', stroke: '#000000', shadow: '#ff0055' },
      { fill: '#00f0ff', stroke: '#000000', shadow: '#ff2d55' },
      { fill: '#ff2a6d', stroke: '#ffffff', shadow: '#05d9e8' },
      { fill: '#ffffff', stroke: '#000000', shadow: '#ffe600' }
    ];
    const colorTheme = options.colorTheme || colors[Math.floor(Math.random() * colors.length)];

    this.comicPopups.push({
      id: Math.random().toString(36).substr(2, 9),
      text,
      x,
      y,
      scale: 0.2,
      targetScale: options.scale || 1.3,
      rotation: (Math.random() - 0.5) * 0.45,
      alpha: 1,
      life: 0,
      maxLife: options.duration || 0.85,
      theme: colorTheme,
      burstSpikes: 10 + Math.floor(Math.random() * 4)
    });
  }

  // Trigger Spider-Sense Danger Warning
  triggerSpiderSense(duration = 1.2) {
    this.spiderSenseActive = true;
    this.spiderSenseIntensity = 1.0;
    this.spiderSenseTimer = duration;
  }

  // Add Screen Shake
  addShake(amount = 12) {
    this.screenShake = Math.max(this.screenShake, amount);
  }

  update(dt) {
    // 1. Update Comic Popups
    for (let i = this.comicPopups.length - 1; i >= 0; i--) {
      const p = this.comicPopups[i];
      p.life += dt;
      // Spring pop in animation
      if (p.life < 0.15) {
        p.scale += (p.targetScale * 1.2 - p.scale) * 25 * dt;
      } else {
        p.scale += (p.targetScale - p.scale) * 10 * dt;
        p.y -= 0.03 * dt; // Float up slightly
      }
      p.alpha = Math.max(0, 1 - (p.life / p.maxLife) ** 2);

      if (p.life >= p.maxLife) {
        this.comicPopups.splice(i, 1);
      }
    }

    // 2. Spider-Sense update
    if (this.spiderSenseActive) {
      this.spiderSenseTimer -= dt;
      this.spiderSenseIntensity = Math.sin(this.spiderSenseTimer * 20) * 0.5 + 0.5;
      if (this.spiderSenseTimer <= 0) {
        this.spiderSenseActive = false;
        this.spiderSenseIntensity = 0;
      }
    }

    // 3. Screen shake dampening
    if (this.screenShake > 0.1) {
      this.screenShake *= Math.pow(0.05, dt);
    } else {
      this.screenShake = 0;
    }

    // 4. Update backdrop elements
    this.clouds.forEach(c => {
      c.x += c.speed * dt;
      if (c.x > 1.2) c.x = -0.3;
    });

    this.searchlights.forEach(s => {
      s.angle += s.speed * dt;
    });
  }

  // Draw Night NYC Skyline Backdrop
  drawSkylineBackdrop(ctx, width, height) {
    if (!ctx) return;

    ctx.save();

    // Dark superhero night sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#0a0d1a');
    skyGrad.addColorStop(0.5, '#151c36');
    skyGrad.addColorStop(0.8, '#261b3b');
    skyGrad.addColorStop(1, '#3b1c32');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Glowing Moon
    const moonX = width * 0.82;
    const moonY = height * 0.18;
    const moonR = 40;
    
    // Moon halo
    const moonHalo = ctx.createRadialGradient(moonX, moonY, moonR * 0.8, moonX, moonY, moonR * 3);
    moonHalo.addColorStop(0, 'rgba(255, 255, 230, 0.4)');
    moonHalo.addColorStop(1, 'rgba(255, 255, 230, 0)');
    ctx.fillStyle = moonHalo;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR * 3, 0, Math.PI * 2);
    ctx.fill();

    // Moon body
    ctx.fillStyle = '#ffffe0';
    ctx.shadowColor = '#ffffaa';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    ctx.fill();

    // Moon craters
    ctx.fillStyle = '#e6e6c8';
    ctx.beginPath();
    ctx.arc(moonX - 10, moonY - 8, 8, 0, Math.PI * 2);
    ctx.arc(moonX + 12, moonY + 10, 6, 0, Math.PI * 2);
    ctx.arc(moonX - 5, moonY + 15, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Searchlights sweeping sky
    this.searchlights.forEach(s => {
      const beamOriginX = s.x * width;
      const beamOriginY = height * 0.85;
      const beamAngle = s.angle + Math.sin(performance.now() * 0.001 * s.speed) * 0.35;
      const beamLen = height * 1.2;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(beamOriginX, beamOriginY);
      ctx.lineTo(beamOriginX + Math.sin(beamAngle - 0.08) * beamLen, beamOriginY - Math.cos(beamAngle - 0.08) * beamLen);
      ctx.lineTo(beamOriginX + Math.sin(beamAngle + 0.08) * beamLen, beamOriginY - Math.cos(beamAngle + 0.08) * beamLen);
      ctx.closePath();

      const beamGrad = ctx.createLinearGradient(beamOriginX, beamOriginY, beamOriginX + Math.sin(beamAngle) * beamLen, 0);
      beamGrad.addColorStop(0, 'rgba(255, 255, 200, 0.25)');
      beamGrad.addColorStop(1, 'rgba(255, 255, 200, 0)');
      ctx.fillStyle = beamGrad;
      ctx.fill();
      ctx.restore();
    });

    // Distant Skyscraper Silhouettes (Layer 1)
    ctx.fillStyle = '#0f1424';
    const b1 = [
      { x: 0.0, w: 0.12, h: 0.55 },
      { x: 0.11, w: 0.09, h: 0.65 },
      { x: 0.19, w: 0.14, h: 0.5 },
      { x: 0.32, w: 0.1, h: 0.72 },
      { x: 0.41, w: 0.15, h: 0.58 },
      { x: 0.55, w: 0.11, h: 0.68 },
      { x: 0.65, w: 0.13, h: 0.52 },
      { x: 0.77, w: 0.12, h: 0.62 },
      { x: 0.88, w: 0.14, h: 0.54 }
    ];
    b1.forEach(b => {
      ctx.fillRect(b.x * width, height * (1 - b.h), b.w * width, height * b.h);
    });

    // Foreground Rooftops (Layer 2) with Lit Windows & Spire Antennas
    ctx.fillStyle = '#070912';
    const b2 = [
      { x: 0.02, w: 0.14, h: 0.42, antenna: true },
      { x: 0.15, w: 0.16, h: 0.35, antenna: false },
      { x: 0.30, w: 0.18, h: 0.48, antenna: true },
      { x: 0.47, w: 0.15, h: 0.38, antenna: false },
      { x: 0.61, w: 0.17, h: 0.45, antenna: true },
      { x: 0.77, w: 0.24, h: 0.36, antenna: false }
    ];
    b2.forEach(b => {
      const bx = b.x * width;
      const by = height * (1 - b.h);
      const bw = b.w * width;
      const bh = height * b.h;
      ctx.fillRect(bx, by, bw, bh);

      // Antenna with blinking red light
      if (b.antenna) {
        ctx.beginPath();
        ctx.moveTo(bx + bw / 2, by);
        ctx.lineTo(bx + bw / 2, by - 35);
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 3;
        ctx.stroke();

        const blink = Math.sin(performance.now() * 0.005) > 0;
        if (blink) {
          ctx.beginPath();
          ctx.arc(bx + bw / 2, by - 35, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#ff2222';
          ctx.shadowColor = '#ff0000';
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // Lit Windows
      const cols = Math.floor(bw / 16);
      const rows = Math.floor(bh / 20);
      for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < cols - 1; c++) {
          // Semi-random window glow
          const seed = (b.x * 100 + r * 13 + c * 7) % 10;
          if (seed > 4) {
            ctx.fillStyle = seed > 7 ? 'rgba(255, 235, 150, 0.85)' : 'rgba(100, 200, 255, 0.6)';
            ctx.fillRect(bx + c * 16, by + r * 20, 8, 10);
          }
        }
      }
    });

    ctx.restore();
  }

  // Draw Spider-Sense Tingling Visual Warning
  drawSpiderSense(ctx, width, height, headX = 0.5, headY = 0.2) {
    if (!this.spiderSenseActive || this.spiderSenseIntensity <= 0) return;

    ctx.save();
    const hx = headX * width;
    const hy = headY * height;
    const alpha = this.spiderSenseIntensity;

    ctx.strokeStyle = `rgba(255, 40, 40, ${alpha * 0.9})`;
    ctx.lineWidth = 3.5;
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur = 15;

    // Classic Marvel Spider-Sense radiating wavy arcs
    const arcs = 4;
    for (let i = 1; i <= arcs; i++) {
      const radius = 35 + i * 22;
      const spread = 0.85; // Angle spread over head
      
      ctx.beginPath();
      for (let a = -spread; a <= spread; a += 0.08) {
        // Wavy high-frequency ripple
        const ripple = Math.sin(a * 14 + performance.now() * 0.02) * 6;
        const currentR = radius + ripple;
        const px = hx + Math.sin(a) * currentR;
        const py = hy - Math.cos(a) * currentR;
        if (a === -spread) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Inner yellow harmonic layer
    ctx.strokeStyle = `rgba(255, 235, 59, ${alpha * 0.8})`;
    ctx.lineWidth = 2;
    for (let i = 1; i <= arcs; i++) {
      const radius = 30 + i * 22;
      const spread = 0.8;
      ctx.beginPath();
      for (let a = -spread; a <= spread; a += 0.08) {
        const ripple = Math.cos(a * 14 - performance.now() * 0.02) * 5;
        const currentR = radius + ripple;
        const px = hx + Math.sin(a) * currentR;
        const py = hy - Math.cos(a) * currentR;
        if (a === -spread) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  // Draw Comic Popups ("THWIP!", "KAPOW!", "SPLAT!")
  drawComicPopups(ctx, width, height) {
    if (!ctx) return;

    this.comicPopups.forEach(p => {
      const px = p.x * width;
      const py = p.y * height;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(px, py);
      ctx.rotate(p.rotation);
      ctx.scale(p.scale, p.scale);

      // Draw Jagged Comic Action Starburst Burst
      ctx.beginPath();
      const spikes = p.burstSpikes;
      const outerR = 65;
      const innerR = 40;
      for (let i = 0; i < spikes * 2; i++) {
        const r = (i % 2 === 0) ? outerR : innerR;
        const angle = (i / (spikes * 2)) * Math.PI * 2;
        const sx = Math.cos(angle) * r;
        const sy = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();

      // Starburst fill & stroke
      ctx.fillStyle = p.theme.shadow;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#000000';
      ctx.stroke();

      // Comic text
      ctx.font = '900 36px "Impact", "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 3D Offset Comic Drop Shadow
      ctx.fillStyle = '#000000';
      ctx.fillText(p.text, 3, 4);

      // Main vibrant text
      ctx.fillStyle = p.theme.fill;
      ctx.fillText(p.text, 0, 0);

      // Bold Comic Outline
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = p.theme.stroke;
      ctx.strokeText(p.text, 0, 0);

      ctx.restore();
    });
  }

  // Apply camera shake transform
  applyShake(ctx) {
    if (this.screenShake > 0.2) {
      const offsetX = (Math.random() - 0.5) * this.screenShake;
      const offsetY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(offsetX, offsetY);
    }
  }
}

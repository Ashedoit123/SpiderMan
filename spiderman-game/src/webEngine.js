// Spider-Man Web Physics Engine with Complete Hand Isolation & 2s Grab Window

export class MovieWebEngine {
  constructor(audioEngine) {
    this.audio = audioEngine;
    this.webs = [];            // Active web ropes
    this.projectiles = [];     // Flying web bullets
    this.splats = [];          // Web impact wall decals
    this.particles = [];       // Silk sparks and dust
    this.webStyle = 'classic'; // 'classic', 'venom', 'symbiote', 'iron'

    this.styleConfigs = {
      classic: {
        color: '#ffffff',
        coreColor: '#f0f9ff',
        glowColor: 'rgba(255, 255, 255, 0.9)',
        lineWidth: 4.0,
        coreWidth: 1.5
      },
      venom: {
        color: '#ffeb3b',
        coreColor: '#00e5ff',
        glowColor: 'rgba(255, 235, 59, 0.9)',
        lineWidth: 4.5,
        coreWidth: 2.0
      },
      symbiote: {
        color: '#1a1a24',
        coreColor: '#9c27b0',
        glowColor: 'rgba(156, 39, 176, 0.8)',
        lineWidth: 5.0,
        coreWidth: 2.5
      },
      iron: {
        color: '#ffc107',
        coreColor: '#ff3d00',
        glowColor: 'rgba(255, 193, 7, 0.9)',
        lineWidth: 4.0,
        coreWidth: 1.8
      }
    };
  }

  setStyle(style) {
    if (this.styleConfigs[style]) {
      this.webStyle = style;
    }
  }

  // Shoot a web attached to a specific handKey ('Right', 'Left', 'Mouse')
  shootWeb(origin, aim, handKey = 'Right') {
    this.audio.playMovieThwip(this.webStyle);

    const dx = aim.x - origin.x;
    const dy = aim.y - origin.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
    const speed = 2.8;

    const projectile = {
      id: Math.random().toString(36).substr(2, 9),
      origin: { ...origin },
      pos: { ...origin },
      vel: { x: (dx / dist) * speed, y: (dy / dist) * speed },
      target: { ...aim },
      maxDist: dist,
      handKey,
      style: this.webStyle,
      alive: true
    };

    this.projectiles.push(projectile);
    this.spawnSilkDust(origin, 8);
    return projectile;
  }

  // Create attached web with 2.0-second Grab Window
  createAttachedWeb(startPoint, anchorPoint, handKey = 'Right') {
    this.audio.playImpactSound();

    const numNodes = 14;
    const nodes = [];
    const dx = (anchorPoint.x - startPoint.x) / numNodes;
    const dy = (anchorPoint.y - startPoint.y) / numNodes;

    for (let i = 0; i <= numNodes; i++) {
      const x = startPoint.x + dx * i;
      const y = startPoint.y + dy * i;
      nodes.push({
        x,
        y,
        oldX: x,
        oldY: y,
        pinned: i === numNodes // Pinned at wall impact
      });
    }

    const web = {
      id: Math.random().toString(36).substr(2, 9),
      nodes,
      anchorPoint: { ...anchorPoint },
      currentHandPoint: { ...startPoint },
      handKey, // Isolated to this exact hand!
      style: this.webStyle,

      // State machine: 'GRAB_WINDOW' -> 'GRABBED' -> 'LET_LOOSE'
      state: 'GRAB_WINDOW',
      grabWindowTimer: 2.0,      // 2.0s window to make a fist
      isGrabbed: false,
      dissolveTimer: 0.8,
      alpha: 1.0,
      tension: 0,
      restLength: Math.sqrt(dx * dx + dy * dy) * numNodes
    };

    this.webs.push(web);
    this.addSplat(anchorPoint);
    return web;
  }

  addSplat(pos) {
    this.splats.push({
      id: Math.random().toString(36).substr(2, 9),
      pos: { ...pos },
      radius: 0.05,
      style: this.webStyle,
      alpha: 1.0,
      life: 0,
      maxLife: 8.0,
      spokes: 8,
      rings: 3
    });
    this.spawnSilkDust(pos, 16);
  }

  // Try to grab web belonging strictly to this handKey
  tryGrabWeb(handKey, wristPos) {
    const eligibleWeb = this.webs
      .filter(w => w.handKey === handKey && w.state === 'GRAB_WINDOW' && w.grabWindowTimer > 0)
      .pop();

    if (eligibleWeb) {
      eligibleWeb.state = 'GRABBED';
      eligibleWeb.isGrabbed = true;
      eligibleWeb.currentHandPoint = { ...wristPos };
      this.audio.playWebGrabSound();
      return true;
    }
    return false;
  }

  // Release webs belonging strictly to this handKey
  releaseWeb(handKey) {
    this.webs.forEach(w => {
      if (w.handKey === handKey && w.state === 'GRABBED') {
        w.state = 'LET_LOOSE';
        w.isGrabbed = false;
        this.audio.playWebDissolveSound();
      }
    });
  }

  spawnSilkDust(pos, count = 10) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 0.2 + 0.05;
      this.particles.push({
        x: pos.x,
        y: pos.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 3 + 1,
        alpha: 1.0,
        life: 0,
        maxLife: Math.random() * 0.35 + 0.15,
        color: this.styleConfigs[this.webStyle].color
      });
    }
  }

  update(dt, handStatesDict = {}) {
    // 1. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;

      const distTraveled = Math.sqrt((p.pos.x - p.origin.x) ** 2 + (p.pos.y - p.origin.y) ** 2);
      
      const hand = handStatesDict[p.handKey];
      if (hand && hand.detected) {
        p.origin = { ...hand.wristScreen };
      }

      if (distTraveled >= p.maxDist || p.pos.x <= 0.02 || p.pos.x >= 0.98 || p.pos.y <= 0.02 || p.pos.y >= 0.98) {
        this.createAttachedWeb(p.origin, p.target, p.handKey);
        this.projectiles.splice(i, 1);
      }
    }

    // 2. Update Active Web Ropes
    for (let i = this.webs.length - 1; i >= 0; i--) {
      const w = this.webs[i];
      const hand = handStatesDict[w.handKey];

      if (w.state === 'GRAB_WINDOW') {
        w.grabWindowTimer -= dt;

        // Follow only its own hand wrist
        if (hand && hand.detected) {
          w.currentHandPoint = { ...hand.wristScreen };
          w.nodes[0].x = hand.wristScreen.x;
          w.nodes[0].y = hand.wristScreen.y;
        }

        // Dissolve if 2 seconds expired without a fist
        if (w.grabWindowTimer <= 0) {
          w.state = 'LET_LOOSE';
          this.audio.playWebDissolveSound();
        }
      } else if (w.state === 'GRABBED') {
        // Locked in this hand's fist
        if (hand && hand.detected && hand.gesture === 'FIST') {
          w.currentHandPoint = { ...hand.wristScreen };
          w.nodes[0].x = hand.wristScreen.x;
          w.nodes[0].y = hand.wristScreen.y;

          const currentDist = Math.sqrt((w.anchorPoint.x - hand.wristScreen.x) ** 2 + (w.anchorPoint.y - hand.wristScreen.y) ** 2);
          w.tension = Math.max(0, (currentDist - w.restLength) * 5);

          if (w.tension > 0.3 && Math.random() < 0.2) {
            this.audio.playTensionCreak(w.tension);
          }
        } else {
          // Hand released or lost -> Let loose
          w.state = 'LET_LOOSE';
          this.audio.playWebDissolveSound();
        }
      } else if (w.state === 'LET_LOOSE') {
        w.dissolveTimer -= dt;
        w.alpha = Math.max(0, w.dissolveTimer / 0.8);
        w.nodes[0].pinned = false; // Detached

        if (w.dissolveTimer <= 0) {
          this.webs.splice(i, 1);
          continue;
        }
      }

      // Verlet Physics
      const gravity = w.state === 'GRABBED' ? 0.15 : 0.45;
      const drag = 0.92;

      w.nodes.forEach((node, idx) => {
        if (!node.pinned && (idx !== 0 || w.state === 'LET_LOOSE')) {
          const vx = (node.x - node.oldX) * drag;
          const vy = (node.y - node.oldY) * drag + gravity * dt * dt;
          node.oldX = node.x;
          node.oldY = node.y;
          node.x += vx;
          node.y += vy;
        }
      });

      // Relaxation constraints
      const segmentLen = w.restLength / w.nodes.length;
      for (let it = 0; it < 5; it++) {
        for (let j = 0; j < w.nodes.length - 1; j++) {
          const n1 = w.nodes[j];
          const n2 = w.nodes[j + 1];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
          const diff = (dist - segmentLen) / dist;

          const ox = dx * diff * 0.5;
          const oy = dy * diff * 0.5;

          const n1Fixed = (j === 0 && w.state !== 'LET_LOOSE');
          const n2Fixed = n2.pinned;

          if (!n1Fixed && !n2Fixed) {
            n1.x += ox; n1.y += oy;
            n2.x -= ox; n2.y -= oy;
          } else if (!n1Fixed && n2Fixed) {
            n1.x += ox * 2; n1.y += oy * 2;
          } else if (n1Fixed && !n2Fixed) {
            n2.x -= ox * 2; n2.y -= oy * 2;
          }
        }
      }
    }

    // 3. Update Splats
    for (let i = this.splats.length - 1; i >= 0; i--) {
      const s = this.splats[i];
      s.life += dt;
      s.alpha = Math.max(0, 1 - s.life / s.maxLife);
      if (s.life >= s.maxLife) {
        this.splats.splice(i, 1);
      }
    }

    // 4. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx, width, height) {
    if (!ctx) return;

    // 1. Draw Impact Splats
    this.splats.forEach(s => {
      const x = s.pos.x * width;
      const y = s.pos.y * height;
      const r = s.radius * width;
      const cfg = this.styleConfigs[s.style] || this.styleConfigs.classic;

      ctx.save();
      ctx.globalAlpha = s.alpha;
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = 2.0;
      ctx.shadowColor = cfg.glowColor;
      ctx.shadowBlur = 8;

      for (let i = 0; i < s.spokes; i++) {
        const ang = (i / s.spokes) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(ang) * r, y + Math.sin(ang) * r);
        ctx.stroke();
      }

      for (let ring = 1; ring <= s.rings; ring++) {
        const rr = (r * ring) / s.rings;
        ctx.beginPath();
        for (let i = 0; i <= s.spokes; i++) {
          const ang = (i / s.spokes) * Math.PI * 2;
          const px = x + Math.cos(ang) * rr;
          const py = y + Math.sin(ang) * rr;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(x, y, r * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = cfg.coreColor;
      ctx.fill();

      ctx.restore();
    });

    // 2. Draw Webs & Grab Indicators
    this.webs.forEach(w => {
      if (w.nodes.length < 2) return;
      const cfg = this.styleConfigs[w.style] || this.styleConfigs.classic;

      ctx.save();
      ctx.globalAlpha = w.alpha;

      // Outer Web Glow
      ctx.beginPath();
      ctx.moveTo(w.nodes[0].x * width, w.nodes[0].y * height);
      for (let j = 1; j < w.nodes.length - 1; j++) {
        const xc = ((w.nodes[j].x + w.nodes[j + 1].x) / 2) * width;
        const yc = ((w.nodes[j].y + w.nodes[j + 1].y) / 2) * height;
        ctx.quadraticCurveTo(w.nodes[j].x * width, w.nodes[j].y * height, xc, yc);
      }
      ctx.lineTo(w.nodes[w.nodes.length - 1].x * width, w.nodes[w.nodes.length - 1].y * height);

      ctx.strokeStyle = w.state === 'GRABBED' ? '#ffd700' : cfg.color;
      ctx.lineWidth = cfg.lineWidth;
      ctx.shadowColor = cfg.glowColor;
      ctx.shadowBlur = 12;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Inner Core
      ctx.beginPath();
      ctx.moveTo(w.nodes[0].x * width, w.nodes[0].y * height);
      for (let j = 1; j < w.nodes.length; j++) {
        ctx.lineTo(w.nodes[j].x * width, w.nodes[j].y * height);
      }
      ctx.strokeStyle = cfg.coreColor;
      ctx.lineWidth = cfg.coreWidth;
      ctx.stroke();

      // 2.0s Grab Window countdown indicator
      if (w.state === 'GRAB_WINDOW') {
        const hx = w.nodes[0].x * width;
        const hy = w.nodes[0].y * height;
        const pulse = Math.sin(performance.now() * 0.015) * 4;
        const frac = Math.max(0, w.grabWindowTimer / 2.0);

        ctx.save();
        ctx.translate(hx, hy);

        // Circular Timer Arc
        ctx.beginPath();
        ctx.arc(0, 0, 24 + pulse, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 3.5;
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 14;
        ctx.stroke();

        ctx.font = '900 12px sans-serif';
        ctx.fillStyle = '#ffff00';
        ctx.textAlign = 'center';
        ctx.fillText(`[${w.handKey.toUpperCase()}] ✊ FIST TO GRAB (${w.grabWindowTimer.toFixed(1)}s)`, 0, -32);
        ctx.restore();
      } else if (w.state === 'GRABBED') {
        const hx = w.nodes[0].x * width;
        const hy = w.nodes[0].y * height;
        ctx.save();
        ctx.translate(hx, hy);
        ctx.font = '900 13px sans-serif';
        ctx.fillStyle = '#00e5ff';
        ctx.textAlign = 'center';
        ctx.fillText(`[${w.handKey.toUpperCase()}] ✊ WEB LOCKED!`, 0, -32);
        ctx.restore();
      }

      ctx.restore();
    });

    // 3. Draw Projectiles
    this.projectiles.forEach(p => {
      const cfg = this.styleConfigs[p.style] || this.styleConfigs.classic;
      const ox = p.origin.x * width;
      const oy = p.origin.y * height;
      const px = p.pos.x * width;
      const py = p.pos.y * height;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(px, py);
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = 3.5;
      ctx.shadowColor = cfg.glowColor;
      ctx.shadowBlur = 12;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fillStyle = cfg.coreColor;
      ctx.fill();
      ctx.restore();
    });

    // 4. Draw Particles
    this.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x * width, p.y * height, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.restore();
    });
  }

  clear() {
    this.webs = [];
    this.projectiles = [];
    this.splats = [];
    this.particles = [];
  }
}

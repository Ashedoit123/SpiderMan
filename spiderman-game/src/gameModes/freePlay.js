// Free Play / Spider-Man Sandbox Mode
// Pure superhero freedom: Physics sandbox, swinging targets, crates, drones, pumpkin bombs & target practice!

export class FreePlayMode {
  constructor(game) {
    this.game = game;
    this.objects = [];
    this.targetsHit = 0;
    this.totalScore = 0;
    this.gravity = 0.5;
    this.initDefaultEntities();
  }

  initDefaultEntities() {
    this.objects = [];

    // 1. Target Bulls-eyes (Floating & Swinging)
    this.spawnTarget(0.25, 0.35, 'wood', 100);
    this.spawnTarget(0.5, 0.25, 'gold', 300);
    this.spawnTarget(0.75, 0.35, 'neon', 200);

    // 2. Oscorp Drone
    this.spawnDrone(0.3, 0.2);
    this.spawnDrone(0.7, 0.18);

    // 3. Physics Crates / Barrels
    this.spawnCrate(0.35, 0.7);
    this.spawnCrate(0.65, 0.7);
    this.spawnBarrel(0.5, 0.75);

    // 4. Bouncing Pumpkin Bomb
    this.spawnPumpkinBomb(0.2, 0.6);
    this.spawnPumpkinBomb(0.8, 0.6);
  }

  spawnTarget(x, y, type = 'wood', points = 100) {
    const target = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'target',
      subType: type,
      x,
      y,
      baseX: x,
      baseY: y,
      vx: 0,
      vy: 0,
      radius: 0.055,
      points,
      alive: true,
      webbed: false,
      swingAngle: 0,
      swingSpeed: 1.2 + Math.random() * 0.8,
      wobble: 0,
      onWebHit: (projectile) => {
        this.targetsHit++;
        this.totalScore += points;
        this.game.vfx.addComicText('BULLSEYE!', target.x, target.y);
        this.game.audio.playComboSound(this.targetsHit);
        target.wobble = 1.0;
        target.vx += projectile.vel.x * 0.3;
        target.vy += projectile.vel.y * 0.3;
      }
    };
    this.objects.push(target);
    return target;
  }

  spawnDrone(x, y) {
    const drone = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'drone',
      x,
      y,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.08,
      radius: 0.045,
      alive: true,
      webbed: false,
      webCount: 0,
      propellerAngle: 0,
      onWebHit: (projectile) => {
        drone.webCount++;
        if (drone.webCount >= 2) {
          drone.alive = false;
          this.game.vfx.addComicText('SPLAT!', drone.x, drone.y);
          this.game.audio.playExplosion(false);
          this.game.vfx.addShake(8);
          this.totalScore += 250;
        } else {
          drone.webbed = true;
          this.game.vfx.addComicText('TRAPPED!', drone.x, drone.y);
          this.game.audio.playSplat();
        }
      }
    };
    this.objects.push(drone);
    return drone;
  }

  spawnCrate(x, y) {
    const crate = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'crate',
      x,
      y,
      vx: 0,
      vy: 0,
      width: 0.08,
      height: 0.08,
      radius: 0.045,
      rotation: 0,
      vRot: 0,
      mass: 2.0,
      alive: true,
      webbed: false,
      onWebHit: (projectile) => {
        crate.vx += projectile.vel.x * 0.25;
        crate.vy += projectile.vel.y * 0.25;
        this.game.vfx.addComicText('THWIP!', crate.x, crate.y);
      }
    };
    this.objects.push(crate);
    return crate;
  }

  spawnBarrel(x, y) {
    const barrel = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'barrel',
      x,
      y,
      vx: 0,
      vy: 0,
      width: 0.07,
      height: 0.09,
      radius: 0.045,
      rotation: 0,
      vRot: 0,
      mass: 2.5,
      alive: true,
      webbed: false,
      onWebHit: (projectile) => {
        barrel.vx += projectile.vel.x * 0.3;
        barrel.vy += projectile.vel.y * 0.3;
        this.game.vfx.addComicText('BONK!', barrel.x, barrel.y);
      }
    };
    this.objects.push(barrel);
    return barrel;
  }

  spawnPumpkinBomb(x, y) {
    const bomb = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'pumpkin',
      x,
      y,
      vx: (Math.random() - 0.5) * 0.2,
      vy: -0.25,
      radius: 0.04,
      rotation: 0,
      alive: true,
      webbed: false,
      glowTimer: 0,
      onWebHit: (projectile) => {
        bomb.webbed = true;
        this.game.vfx.addComicText('CAUGHT!', bomb.x, bomb.y);
        this.game.audio.playSplat();
      }
    };
    this.objects.push(bomb);
    return bomb;
  }

  // Clear and respawn fresh sandbox
  reset() {
    this.initDefaultEntities();
    this.game.webEngine.clear();
  }

  update(dt, handStates = []) {
    const groundY = 0.88;

    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];
      if (!obj.alive) {
        this.objects.splice(i, 1);
        continue;
      }

      // Update specific entity types
      if (obj.type === 'target') {
        obj.swingAngle += obj.swingSpeed * dt;
        obj.x = obj.baseX + Math.sin(obj.swingAngle) * 0.08 + obj.vx;
        obj.y = obj.baseY + Math.cos(obj.swingAngle * 0.5) * 0.03 + obj.vy;
        obj.vx *= 0.95;
        obj.vy *= 0.95;
        if (obj.wobble > 0) obj.wobble = Math.max(0, obj.wobble - dt * 2);
      } else if (obj.type === 'drone') {
        if (!obj.webbed) {
          obj.x += obj.vx * dt;
          obj.y += obj.vy * dt;
          obj.propellerAngle += 30 * dt;

          if (obj.x < 0.1 || obj.x > 0.9) obj.vx *= -1;
          if (obj.y < 0.08 || obj.y > 0.45) obj.vy *= -1;
        } else {
          // Falling under web weight
          obj.vy += this.gravity * 0.8 * dt;
          obj.y += obj.vy * dt;
          obj.x += obj.vx * dt;
          if (obj.y > groundY) {
            obj.y = groundY;
            obj.alive = false;
            this.game.vfx.addComicText('CRASH!', obj.x, obj.y);
            this.game.audio.playExplosion(false);
          }
        }
      } else if (obj.type === 'crate' || obj.type === 'barrel') {
        obj.vy += this.gravity * dt;
        obj.x += obj.vx * dt;
        obj.y += obj.vy * dt;
        obj.rotation += obj.vRot * dt;

        // Ground collision & bouncing
        if (obj.y >= groundY - obj.radius) {
          obj.y = groundY - obj.radius;
          obj.vy = -obj.vy * 0.35;
          obj.vx *= 0.85;
          obj.vRot *= 0.8;
        }

        // Screen boundary bounce
        if (obj.x <= obj.radius) {
          obj.x = obj.radius;
          obj.vx = -obj.vx * 0.5;
        } else if (obj.x >= 1 - obj.radius) {
          obj.x = 1 - obj.radius;
          obj.vx = -obj.vx * 0.5;
        }
      } else if (obj.type === 'pumpkin') {
        obj.vy += this.gravity * 0.8 * dt;
        obj.x += obj.vx * dt;
        obj.y += obj.vy * dt;
        obj.rotation += 3 * dt;
        obj.glowTimer += dt;

        // Bouncing pumpkin bomb
        if (obj.y >= groundY - obj.radius) {
          obj.y = groundY - obj.radius;
          obj.vy = -Math.abs(obj.vy) * 0.75;
          if (Math.abs(obj.vy) < 0.05) obj.vy = -0.3; // Re-bounce
        }
        if (obj.x <= obj.radius || obj.x >= 1 - obj.radius) {
          obj.vx *= -1;
        }
      }
    }
  }

  draw(ctx, width, height) {
    if (!ctx) return;

    this.objects.forEach(obj => {
      if (!obj.alive) return;
      const x = obj.x * width;
      const y = obj.y * height;

      ctx.save();
      ctx.translate(x, y);

      if (obj.type === 'target') {
        // Target tether cord
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -y + 10);
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();

        const r = obj.radius * width;
        const scale = 1 + (obj.wobble || 0) * 0.2;
        ctx.scale(scale, scale);

        // Concentric Bulls-eye rings
        const colors = obj.subType === 'gold' 
          ? ['#ffd700', '#ffffff', '#ff9800', '#d50000']
          : obj.subType === 'neon'
          ? ['#00ffff', '#ff007f', '#00ff66', '#ffffff']
          : ['#d50000', '#ffffff', '#d50000', '#ffffff'];

        for (let i = colors.length - 1; i >= 0; i--) {
          ctx.beginPath();
          ctx.arc(0, 0, (r * (i + 1)) / colors.length, 0, Math.PI * 2);
          ctx.fillStyle = colors[i];
          ctx.shadowColor = colors[i];
          ctx.shadowBlur = 8;
          ctx.fill();
        }

        // Center star
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = '#ffff00';
        ctx.fill();

        // Points label
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.fillText(`${obj.points}`, 0, 4);

      } else if (obj.type === 'drone') {
        const r = obj.radius * width;
        
        // Propellers
        ctx.save();
        ctx.rotate(obj.propellerAngle);
        ctx.fillStyle = 'rgba(0, 229, 255, 0.8)';
        ctx.fillRect(-r * 1.3, -2, r * 2.6, 4);
        ctx.fillRect(-2, -r * 1.3, 4, r * 2.6);
        ctx.restore();

        // Drone metallic chassis (Oscorp style)
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
        ctx.fillStyle = '#263238';
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#00e5ff';
        ctx.stroke();

        // Glowing red sensor eye
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = '#ff1744';
        ctx.shadowColor = '#ff1744';
        ctx.shadowBlur = 12;
        ctx.fill();

      } else if (obj.type === 'crate') {
        const w = obj.width * width;
        const h = obj.height * height;
        ctx.rotate(obj.rotation);

        // Wooden Crate body
        ctx.fillStyle = '#8d6e63';
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeStyle = '#4e342e';
        ctx.lineWidth = 3;
        ctx.strokeRect(-w / 2, -h / 2, w, h);

        // Diagonal planks
        ctx.beginPath();
        ctx.moveTo(-w / 2, -h / 2);
        ctx.lineTo(w / 2, h / 2);
        ctx.moveTo(w / 2, -h / 2);
        ctx.lineTo(-w / 2, h / 2);
        ctx.stroke();

      } else if (obj.type === 'barrel') {
        const w = obj.width * width;
        const h = obj.height * height;
        ctx.rotate(obj.rotation);

        // Steel Toxic / Fuel Barrel
        ctx.fillStyle = '#f44336';
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeStyle = '#212121';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(-w / 2, -h / 2, w, h);

        // Steel reinforcement ribs
        ctx.beginPath();
        ctx.moveTo(-w / 2, -h * 0.2);
        ctx.lineTo(w / 2, -h * 0.2);
        ctx.moveTo(-w / 2, h * 0.2);
        ctx.lineTo(w / 2, h * 0.2);
        ctx.strokeStyle = '#ffebee';
        ctx.stroke();

        // Hazard symbol
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡', 0, 4);

      } else if (obj.type === 'pumpkin') {
        const r = obj.radius * width;
        ctx.rotate(obj.rotation);

        // Glowing Green Goblin Pumpkin Bomb
        const glow = Math.sin(obj.glowTimer * 10) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = '#ff6d00';
        ctx.shadowColor = '#ff3d00';
        ctx.shadowBlur = 16 * glow;
        ctx.fill();

        // Jack-O-Lantern glowing menacing face
        ctx.fillStyle = '#ffff00';
        // Left eye
        ctx.beginPath();
        ctx.moveTo(-r * 0.4, -r * 0.2);
        ctx.lineTo(-r * 0.15, -r * 0.4);
        ctx.lineTo(-r * 0.1, -r * 0.1);
        ctx.closePath();
        ctx.fill();

        // Right eye
        ctx.beginPath();
        ctx.moveTo(r * 0.4, -r * 0.2);
        ctx.lineTo(r * 0.15, -r * 0.4);
        ctx.lineTo(r * 0.1, -r * 0.1);
        ctx.closePath();
        ctx.fill();

        // Grinning jagged mouth
        ctx.beginPath();
        ctx.arc(0, r * 0.1, r * 0.5, 0.2, Math.PI - 0.2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffff00';
        ctx.stroke();
      }

      ctx.restore();
    });
  }
}

// Target Frenzy Mode - 60-Second Arcade Web Rush!

export class TargetFrenzyMode {
  constructor(game) {
    this.game = game;
    this.timeLeft = 60.0;
    this.score = 0;
    this.targets = [];
    this.combo = 0;
    this.comboTimer = 0;
    this.gameOver = false;
    this.spawnTimer = 0;
    this.highScore = parseInt(localStorage.getItem('spidey_frenzy_high') || '0', 10);

    this.initTargets();
    this.game.audio.speak('60 seconds on the clock! Rapid-fire web targets!');
  }

  initTargets() {
    this.targets = [];
    for (let i = 0; i < 5; i++) {
      this.spawnRandomTarget();
    }
  }

  spawnRandomTarget() {
    const types = [
      { type: 'gold', points: 500, radius: 0.045, color: '#ffd700', speed: 0.25 },
      { type: 'red', points: 200, radius: 0.055, color: '#ff1744', speed: 0.15 },
      { type: 'blue', points: 100, radius: 0.065, color: '#00e5ff', speed: 0.1 },
      { type: 'glider', points: 350, radius: 0.05, color: '#76ff03', speed: 0.35 }
    ];
    const cfg = types[Math.floor(Math.random() * types.length)];

    const target = {
      id: Math.random().toString(36).substr(2, 9),
      type: cfg.type,
      points: cfg.points,
      color: cfg.color,
      radius: cfg.radius,
      x: 0.1 + Math.random() * 0.8,
      y: 0.1 + Math.random() * 0.5,
      vx: (Math.random() - 0.5) * cfg.speed,
      vy: (Math.random() - 0.5) * cfg.speed * 0.6,
      alive: true,
      age: 0,
      maxAge: 6.0 + Math.random() * 3.0,
      scale: 0.1,
      onWebHit: (projectile) => {
        target.alive = false;
        this.combo++;
        this.comboTimer = 3.0;
        const pts = target.points * Math.min(5, this.combo);
        this.score += pts;
        this.game.vfx.addComicText(`+${pts}!`, target.x, target.y);
        this.game.audio.playComboSound(this.combo);
        this.game.vfx.addShake(6);

        if (this.score > this.highScore) {
          this.highScore = this.score;
          localStorage.setItem('spidey_frenzy_high', this.highScore.toString());
        }
      }
    };
    this.targets.push(target);
  }

  update(dt, handStates = []) {
    if (this.gameOver) return;

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.gameOver = true;
      this.game.audio.playExplosion(true);
      this.game.audio.speak(`Time up! Final Score: ${this.score}! Amazing shooting!`);
      return;
    }

    // Combo decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
      }
    }

    // Target spawning
    this.spawnTimer += dt;
    if (this.targets.length < 6 && this.spawnTimer > 0.8) {
      this.spawnTimer = 0;
      this.spawnRandomTarget();
    }

    // Update targets
    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      if (!t.alive) {
        this.targets.splice(i, 1);
        continue;
      }

      t.age += dt;
      if (t.scale < 1.0) t.scale = Math.min(1.0, t.scale + dt * 5);

      t.x += t.vx * dt;
      t.y += t.vy * dt;

      if (t.x < 0.08 || t.x > 0.92) t.vx *= -1;
      if (t.y < 0.08 || t.y > 0.65) t.vy *= -1;

      if (t.age >= t.maxAge) {
        t.alive = false;
      }
    }
  }

  draw(ctx, width, height) {
    if (!ctx) return;

    // Draw Targets
    this.targets.forEach(t => {
      if (!t.alive) return;
      const x = t.x * width;
      const y = t.y * height;
      const r = t.radius * width * t.scale;

      ctx.save();
      ctx.translate(x, y);

      // Outer ring
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = t.color;
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Inner rings
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = t.color;
      ctx.fill();

      // Points label
      ctx.font = '900 12px "Impact", sans-serif';
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${t.points}`, 0, 0);

      ctx.restore();
    });

    // HUD: Timer & Score
    ctx.save();
    ctx.font = '900 30px "Impact", sans-serif';
    ctx.fillStyle = this.timeLeft < 10 ? '#ff1744' : '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(`TIME: ${Math.ceil(this.timeLeft)}s`, 25, 40);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`SCORE: ${this.score}`, width - 25, 40);

    if (this.combo > 1) {
      ctx.fillStyle = '#00e5ff';
      ctx.font = '900 20px "Impact", sans-serif';
      ctx.fillText(`${this.combo}x COMBO!`, width - 25, 68);
    }

    if (this.gameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(0, height * 0.3, width, height * 0.35);
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 3;
      ctx.strokeRect(0, height * 0.3, width, height * 0.35);

      ctx.font = '900 42px "Impact", sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.textAlign = 'center';
      ctx.fillText('TIME OVER!', width / 2, height * 0.42);

      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`FINAL SCORE: ${this.score}`, width / 2, height * 0.50);
      ctx.fillText(`HIGH SCORE: ${this.highScore}`, width / 2, height * 0.57);
    }

    ctx.restore();
  }
}

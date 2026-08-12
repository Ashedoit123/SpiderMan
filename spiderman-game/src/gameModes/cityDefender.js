// City Defender Mode - Wave-based Superhero Story Campaign
// Battle Oscorp Drones, Pumpkin Bombs, Vulture, Green Goblin, and Doc Ock Tentacles!

export class CityDefenderMode {
  constructor(game) {
    this.game = game;
    this.wave = 1;
    this.maxWaves = 5;
    this.waveState = 'PLAYING'; // 'INTRO', 'PLAYING', 'VICTORY', 'GAMEOVER'
    this.waveTimer = 0;
    this.cityHealth = 100;
    this.maxCityHealth = 100;
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.enemies = [];
    this.boss = null;
    this.spawnTimer = 0;
    this.enemiesRemaining = 0;
    this.introTimer = 3.0;

    this.startWave(1);
  }

  startWave(waveNum) {
    this.wave = waveNum;
    this.waveState = 'INTRO';
    this.introTimer = 2.5;
    this.enemies = [];
    this.boss = null;
    this.spawnTimer = 0;

    const waveNames = {
      1: 'WAVE 1: OSCORP DRONE PATROL',
      2: 'WAVE 2: PUMPKIN BOMB BARRAGE',
      3: 'WAVE 3: VULTURE AIR RAID',
      4: 'BOSS: GREEN GOBLIN SHOWDOWN!',
      5: 'BOSS: DOC OCK TENTACLE SIEGE!'
    };

    this.waveTitle = waveNames[waveNum] || `WAVE ${waveNum}`;

    if (waveNum === 1) {
      this.enemiesRemaining = 8;
      this.game.audio.speak('Oscorp drones incoming! Shoot them down, Spider-Man!');
    } else if (waveNum === 2) {
      this.enemiesRemaining = 12;
      this.game.audio.speak('Incoming pumpkin bombs! Trust your Spider-Sense!');
    } else if (waveNum === 3) {
      this.enemiesRemaining = 6;
      this.game.audio.speak('Vulture is dive bombing the city! Web his wings!');
    } else if (waveNum === 4) {
      this.enemiesRemaining = 1;
      this.spawnGoblinBoss();
      this.game.audio.speak('Can the Spider-Man come out to play?! Hahaha!');
    } else if (waveNum === 5) {
      this.enemiesRemaining = 1;
      this.spawnDocOckBoss();
      this.game.audio.speak('The power of the sun in the palm of my hand!');
    }
  }

  spawnGoblinBoss() {
    this.boss = {
      type: 'goblin',
      name: 'GREEN GOBLIN',
      x: 0.5,
      y: 0.2,
      vx: 0.25,
      vy: 0.1,
      radius: 0.08,
      hp: 100,
      maxHp: 100,
      alive: true,
      flightAngle: 0,
      bombCooldown: 2.2,
      laughTimer: 4.0,
      gliderTilt: 0,
      onWebHit: (projectile) => {
        this.boss.hp -= 12;
        this.game.audio.playExplosion(false);
        this.game.vfx.addComicText('KAPOW!', this.boss.x, this.boss.y);
        this.game.vfx.addShake(10);
        this.score += 200;
        this.addCombo();

        if (this.boss.hp <= 0) {
          this.boss.alive = false;
          this.game.audio.playExplosion(true);
          this.game.vfx.addComicText('DEFEATED!', this.boss.x, this.boss.y, { scale: 2.0 });
          this.game.vfx.addShake(20);
          this.game.audio.speak('Goblin is down! Outstanding job!');
          this.score += 5000;
        }
      }
    };
    this.game.audio.playGliderSwoop();
  }

  spawnDocOckBoss() {
    this.boss = {
      type: 'docock',
      name: 'DOC OCK',
      x: 0.5,
      y: 0.3,
      hp: 120,
      maxHp: 120,
      alive: true,
      tentacles: [
        { id: 0, originX: 0.05, originY: 0.2, targetX: 0.35, targetY: 0.45, hp: 30, webbed: false, angle: 0 },
        { id: 1, originX: 0.95, originY: 0.2, targetX: 0.65, targetY: 0.45, hp: 30, webbed: false, angle: 0 },
        { id: 2, originX: 0.05, originY: 0.7, targetX: 0.3, targetY: 0.6, hp: 30, webbed: false, angle: 0 },
        { id: 3, originX: 0.95, originY: 0.7, targetX: 0.7, targetY: 0.6, hp: 30, webbed: false, angle: 0 }
      ],
      attackTimer: 2.0,
      onWebHit: (projectile) => {
        this.boss.hp -= 15;
        this.game.audio.playExplosion(false);
        this.game.vfx.addComicText('SMASH!', projectile.pos.x, projectile.pos.y);
        this.game.vfx.addShake(8);
        this.score += 250;
        this.addCombo();

        if (this.boss.hp <= 0) {
          this.boss.alive = false;
          this.game.audio.playExplosion(true);
          this.game.vfx.addComicText('VICTORY!', 0.5, 0.5, { scale: 2.2 });
          this.game.vfx.addShake(25);
          this.game.audio.speak('Doc Ock is neutralized! You saved New York City!');
          this.score += 10000;
        }
      }
    };
  }

  addCombo() {
    this.combo++;
    this.comboTimer = 3.5;
    if (this.combo >= 3) {
      this.game.audio.playComboSound(this.combo);
    }
  }

  update(dt, handStates = []) {
    // Combo timer decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
      }
    }

    if (this.waveState === 'INTRO') {
      this.introTimer -= dt;
      if (this.introTimer <= 0) {
        this.waveState = 'PLAYING';
      }
      return;
    }

    if (this.waveState === 'VICTORY' || this.waveState === 'GAMEOVER') {
      return;
    }

    // Spawn regular wave enemies
    this.spawnTimer += dt;
    if (this.wave === 1 && this.enemiesRemaining > 0 && this.spawnTimer > 1.4) {
      this.spawnTimer = 0;
      this.spawnDroneEnemy();
      this.enemiesRemaining--;
    } else if (this.wave === 2 && this.enemiesRemaining > 0 && this.spawnTimer > 1.2) {
      this.spawnTimer = 0;
      this.spawnPumpkinBombEnemy();
      this.enemiesRemaining--;
    } else if (this.wave === 3 && this.enemiesRemaining > 0 && this.spawnTimer > 2.0) {
      this.spawnTimer = 0;
      this.spawnVultureEnemy();
      this.enemiesRemaining--;
    }

    // Update Bosses
    if (this.boss && this.boss.alive) {
      if (this.boss.type === 'goblin') {
        this.updateGoblinBoss(dt);
      } else if (this.boss.type === 'docock') {
        this.updateDocOckBoss(dt);
      }
    }

    // Update active enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive) {
        this.enemies.splice(i, 1);
        continue;
      }

      e.x += e.vx * dt;
      e.y += e.vy * dt;

      if (e.type === 'drone') {
        e.propeller += 25 * dt;
        if (e.x < 0.05 || e.x > 0.95) e.vx *= -1;
        // Drones reach city floor
        if (e.y > 0.85) {
          e.alive = false;
          this.damageCity(10);
        }
      } else if (e.type === 'pumpkin_bomb') {
        e.timer -= dt;
        e.rotation += 8 * dt;

        // Spider sense trigger when bomb is close to detonate!
        if (e.timer < 1.2 && !e.spiderSenseTriggered) {
          e.spiderSenseTriggered = true;
          this.game.vfx.triggerSpiderSense(1.2);
          this.game.audio.playSpiderSense();
        }

        if (e.timer <= 0) {
          e.alive = false;
          this.game.audio.playExplosion(false);
          this.game.vfx.addComicText('BOOM!', e.x, e.y);
          this.game.vfx.addShake(14);
          this.damageCity(15);
        }
      } else if (e.type === 'vulture') {
        e.wingAngle = Math.sin(performance.now() * 0.01) * 0.4;
        if (e.y > 0.88 || e.x < -0.1 || e.x > 1.1) {
          e.alive = false;
          if (e.y > 0.8) this.damageCity(12);
        }
      }
    }

    // Check Wave Completion
    if (this.enemiesRemaining === 0 && this.enemies.length === 0 && (!this.boss || !this.boss.alive)) {
      if (this.wave < this.maxWaves) {
        this.startWave(this.wave + 1);
      } else {
        this.waveState = 'VICTORY';
        this.game.audio.speak('Incredible! You defeated all the villains! You are the Spectacular Spider-Man!');
      }
    }
  }

  spawnDroneEnemy() {
    const drone = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'drone',
      x: 0.1 + Math.random() * 0.8,
      y: -0.05,
      vx: (Math.random() - 0.5) * 0.2,
      vy: 0.08 + Math.random() * 0.06,
      radius: 0.045,
      propeller: 0,
      alive: true,
      onWebHit: (projectile) => {
        drone.alive = false;
        this.game.audio.playExplosion(false);
        this.game.vfx.addComicText('THWIP!', drone.x, drone.y);
        this.score += 150 * (this.combo + 1);
        this.addCombo();
      }
    };
    this.enemies.push(drone);
  }

  spawnPumpkinBombEnemy() {
    const bomb = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'pumpkin_bomb',
      x: 0.15 + Math.random() * 0.7,
      y: 0.05,
      vx: (Math.random() - 0.5) * 0.12,
      vy: 0.14 + Math.random() * 0.08,
      radius: 0.04,
      rotation: 0,
      timer: 3.5,
      spiderSenseTriggered: false,
      alive: true,
      onWebHit: (projectile) => {
        bomb.alive = false;
        this.game.audio.playSplat();
        this.game.vfx.addComicText('DISARMED!', bomb.x, bomb.y);
        this.score += 250 * (this.combo + 1);
        this.addCombo();
      }
    };
    this.enemies.push(bomb);
  }

  spawnVultureEnemy() {
    const startLeft = Math.random() > 0.5;
    const vulture = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'vulture',
      x: startLeft ? -0.05 : 1.05,
      y: 0.15,
      vx: startLeft ? 0.35 : -0.35,
      vy: 0.12,
      radius: 0.065,
      wingAngle: 0,
      alive: true,
      onWebHit: (projectile) => {
        vulture.alive = false;
        this.game.audio.playExplosion(false);
        this.game.vfx.addComicText('WINGED!', vulture.x, vulture.y);
        this.score += 350 * (this.combo + 1);
        this.addCombo();
      }
    };
    this.enemies.push(vulture);
  }

  updateGoblinBoss(dt) {
    this.boss.flightAngle += 1.8 * dt;
    this.boss.x = 0.5 + Math.sin(this.boss.flightAngle) * 0.35;
    this.boss.y = 0.22 + Math.cos(this.boss.flightAngle * 1.5) * 0.08;
    this.boss.gliderTilt = Math.sin(this.boss.flightAngle) * 0.35;

    // Goblin Laugh
    this.boss.laughTimer -= dt;
    if (this.boss.laughTimer <= 0) {
      this.boss.laughTimer = 5.0;
      this.game.audio.playGliderSwoop();
    }

    // Throw Pumpkin Bombs
    this.boss.bombCooldown -= dt;
    if (this.boss.bombCooldown <= 0) {
      this.boss.bombCooldown = 2.4;
      this.spawnPumpkinBombEnemy();
      this.game.vfx.triggerSpiderSense(1.0);
      this.game.audio.playSpiderSense();
    }
  }

  updateDocOckBoss(dt) {
    this.boss.attackTimer -= dt;
    if (this.boss.attackTimer <= 0) {
      this.boss.attackTimer = 3.0;
      // Strike tentacle towards center
      const t = this.boss.tentacles[Math.floor(Math.random() * this.boss.tentacles.length)];
      this.game.vfx.triggerSpiderSense(1.2);
      this.game.audio.playSpiderSense();
    }

    this.boss.tentacles.forEach(t => {
      t.angle = Math.sin(performance.now() * 0.003 + t.id) * 0.2;
    });
  }

  damageCity(amount) {
    this.cityHealth = Math.max(0, this.cityHealth - amount);
    this.game.vfx.addShake(12);
    if (this.cityHealth <= 0) {
      this.waveState = 'GAMEOVER';
      this.game.audio.speak('The city has fallen! Try again, Spider-Man!');
    }
  }

  draw(ctx, width, height) {
    if (!ctx) return;

    // 1. Draw Active Wave Enemies
    this.enemies.forEach(e => {
      if (!e.alive) return;
      const x = e.x * width;
      const y = e.y * height;
      const r = e.radius * width;

      ctx.save();
      ctx.translate(x, y);

      if (e.type === 'drone') {
        // Drone propellers
        ctx.save();
        ctx.rotate(e.propeller);
        ctx.fillStyle = 'rgba(0, 229, 255, 0.7)';
        ctx.fillRect(-r * 1.2, -2, r * 2.4, 4);
        ctx.fillRect(-2, -r * 1.2, 4, r * 2.4);
        ctx.restore();

        // Drone chassis
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = '#37474f';
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#00e5ff';
        ctx.stroke();

        // Glowing red eye
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
        ctx.fillStyle = '#ff1744';
        ctx.fill();

      } else if (e.type === 'pumpkin_bomb') {
        ctx.rotate(e.rotation);
        // Pumpkin Bomb
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = '#ff6d00';
        ctx.shadowColor = '#ff3d00';
        ctx.shadowBlur = 14;
        ctx.fill();

        // Menacing face
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(-r * 0.35, -r * 0.2, r * 0.2, r * 0.2);
        ctx.fillRect(r * 0.15, -r * 0.2, r * 0.2, r * 0.2);
        ctx.fillRect(-r * 0.3, r * 0.15, r * 0.6, r * 0.15);

        // Timer badge
        ctx.rotate(-e.rotation);
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(`${e.timer.toFixed(1)}s`, 0, -r - 5);

      } else if (e.type === 'vulture') {
        // Vulture green wings
        ctx.save();
        ctx.rotate(e.wingAngle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-r * 1.6, -r * 0.5);
        ctx.lineTo(-r * 1.8, r * 0.3);
        ctx.lineTo(0, r * 0.4);
        ctx.lineTo(r * 1.8, r * 0.3);
        ctx.lineTo(r * 1.6, -r * 0.5);
        ctx.closePath();
        ctx.fillStyle = '#2e7d32';
        ctx.shadowColor = '#00e676';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.strokeStyle = '#a5d6a7';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Metallic helmet
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#546e7a';
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    });

    // 2. Draw Boss
    if (this.boss && this.boss.alive) {
      const bx = this.boss.x * width;
      const by = this.boss.y * height;
      const br = this.boss.radius * width;

      ctx.save();
      ctx.translate(bx, by);

      if (this.boss.type === 'goblin') {
        ctx.rotate(this.boss.gliderTilt);

        // Goblin Glider Wings (Silver bat-wings)
        ctx.beginPath();
        ctx.moveTo(0, 15);
        ctx.lineTo(-br * 1.6, 5);
        ctx.lineTo(-br * 1.9, -15);
        ctx.lineTo(-br * 0.8, -5);
        ctx.lineTo(0, 0);
        ctx.lineTo(br * 0.8, -5);
        ctx.lineTo(br * 1.9, -15);
        ctx.lineTo(br * 1.6, 5);
        ctx.closePath();
        ctx.fillStyle = '#90a4ae';
        ctx.shadowColor = '#cfd8dc';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#37474f';
        ctx.stroke();

        // Glider Thrusters (purple energy flame)
        ctx.beginPath();
        ctx.moveTo(-br * 0.5, 10);
        ctx.lineTo(0, 32 + Math.sin(performance.now() * 0.05) * 8);
        ctx.lineTo(br * 0.5, 10);
        ctx.fillStyle = '#d500f9';
        ctx.shadowColor = '#ea80fc';
        ctx.shadowBlur = 16;
        ctx.fill();

        // Green Goblin Character Body
        ctx.beginPath();
        ctx.arc(0, -18, br * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = '#00c853';
        ctx.shadowColor = '#00e676';
        ctx.shadowBlur = 10;
        ctx.fill();

        // Purple hood / tunic
        ctx.beginPath();
        ctx.moveTo(-br * 0.4, -10);
        ctx.lineTo(0, -38);
        ctx.lineTo(br * 0.4, -10);
        ctx.closePath();
        ctx.fillStyle = '#aa00ff';
        ctx.fill();

        // Glowing yellow Goblin eyes
        ctx.fillStyle = '#ffeb3b';
        ctx.fillRect(-8, -22, 5, 4);
        ctx.fillRect(3, -22, 5, 4);

        ctx.restore();

        // Boss Health Bar HUD
        this.drawBossHealthBar(ctx, width, height, this.boss.name, this.boss.hp, this.boss.maxHp);

      } else if (this.boss.type === 'docock') {
        // Doc Ock Tentacles (Curving mechanical arms with 3 claws)
        this.boss.tentacles.forEach(t => {
          const ox = t.originX * width;
          const oy = t.originY * height;
          const tx = t.targetX * width;
          const ty = t.targetY * height;

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.quadraticCurveTo((ox + tx) / 2, (oy + ty) / 2 - 60, tx, ty);
          ctx.strokeStyle = '#78909c';
          ctx.lineWidth = 14;
          ctx.lineCap = 'round';
          ctx.shadowColor = '#00e5ff';
          ctx.shadowBlur = 8;
          ctx.stroke();

          // Glowing energy rings on tentacle
          ctx.strokeStyle = '#00e5ff';
          ctx.lineWidth = 4;
          ctx.stroke();

          // 3-Claw Pincer Head
          ctx.translate(tx, ty);
          ctx.rotate(t.angle);
          for (let c = 0; c < 3; c++) {
            ctx.save();
            ctx.rotate(c * (Math.PI * 2 / 3));
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(16, 12);
            ctx.strokeStyle = '#e53935';
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.restore();
          }

          // Glowing central core (Hit target!)
          ctx.beginPath();
          ctx.arc(0, 0, 10, 0, Math.PI * 2);
          ctx.fillStyle = '#ff1744';
          ctx.shadowColor = '#ff5252';
          ctx.shadowBlur = 14;
          ctx.fill();

          ctx.restore();
        });

        // Doc Ock Silhouette in center
        ctx.save();
        ctx.translate(bx, by);
        ctx.beginPath();
        ctx.arc(0, 0, br * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = '#212121';
        ctx.fill();
        // Green trenchcoat
        ctx.fillStyle = '#1b5e20';
        ctx.fillRect(-br * 0.4, 0, br * 0.8, br * 0.8);
        // Yellow sunglasses
        ctx.fillStyle = '#ffeb3b';
        ctx.fillRect(-10, -5, 8, 4);
        ctx.fillRect(2, -5, 8, 4);
        ctx.restore();

        this.drawBossHealthBar(ctx, width, height, this.boss.name, this.boss.hp, this.boss.maxHp);
      }
    }

    // 3. Draw Mode UI Overlay (Score, Wave Title, City Health)
    this.drawModeHUD(ctx, width, height);
  }

  drawBossHealthBar(ctx, width, height, name, hp, maxHp) {
    const barW = Math.min(360, width * 0.6);
    const barH = 18;
    const barX = (width - barW) / 2;
    const barY = 55;

    ctx.save();
    // Name label
    ctx.font = '900 14px "Impact", sans-serif';
    ctx.fillStyle = '#ff1744';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    ctx.fillText(`⚡ ${name} ⚡`, width / 2, barY - 6);

    // Frame
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(barX - 4, barY - 4, barW + 8, barH + 8);
    ctx.strokeStyle = '#ff1744';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX - 4, barY - 4, barW + 8, barH + 8);

    // Fill
    const fillW = Math.max(0, (hp / maxHp) * barW);
    const hpGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    hpGrad.addColorStop(0, '#d50000');
    hpGrad.addColorStop(1, '#ff6d00');
    ctx.fillStyle = hpGrad;
    ctx.fillRect(barX, barY, fillW, barH);

    ctx.restore();
  }

  drawModeHUD(ctx, width, height) {
    ctx.save();

    // Wave Title Banner (during intro)
    if (this.waveState === 'INTRO') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, height * 0.35, width, height * 0.2);
      ctx.strokeStyle = '#ff1744';
      ctx.lineWidth = 3;
      ctx.strokeRect(0, height * 0.35, width, height * 0.2);

      ctx.font = '900 32px "Impact", sans-serif';
      ctx.fillStyle = '#ffff00';
      ctx.textAlign = 'center';
      ctx.fillText(this.waveTitle, width / 2, height * 0.44);

      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Get ready to shoot webs!', width / 2, height * 0.51);
    }

    // City Health Gauge (Top Left)
    const chX = 20;
    const chY = 20;
    const chW = 180;
    const chH = 14;

    ctx.fillStyle = 'rgba(10, 10, 20, 0.8)';
    ctx.fillRect(chX, chY, chW, chH);
    ctx.strokeStyle = '#3949ab';
    ctx.lineWidth = 2;
    ctx.strokeRect(chX, chY, chW, chH);

    const healthFill = (this.cityHealth / this.maxCityHealth) * chW;
    ctx.fillStyle = this.cityHealth > 30 ? '#00e676' : '#ff1744';
    ctx.fillRect(chX, chY, healthFill, chH);

    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(`NYC DEFENSE: ${Math.round(this.cityHealth)}%`, chX, chY - 5);

    // Score & Combo (Top Right)
    ctx.textAlign = 'right';
    ctx.font = '900 22px "Impact", sans-serif';
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`SCORE: ${this.score}`, width - 20, 35);

    if (this.combo > 1) {
      ctx.font = '900 18px "Impact", sans-serif';
      ctx.fillStyle = '#00e5ff';
      ctx.fillText(`COMBO x${this.combo}!`, width - 20, 60);
    }

    ctx.restore();
  }
}

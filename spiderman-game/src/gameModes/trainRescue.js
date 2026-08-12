// Train Rescue Mode - The Iconic Two-Handed Spider-Man 2 Runaway Train Stop!

export class TrainRescueMode {
  constructor(game) {
    this.game = game;
    this.trainSpeed = 100; // km/h
    this.initialSpeed = 100;
    this.distanceToCliff = 1000; // meters
    this.tension = 0; // 0 to 100%
    this.stopped = false;
    this.failed = false;
    this.leftHandWebbed = false;
    this.rightHandWebbed = false;
    this.strainSoundTimer = 0;
    this.sparkTimer = 0;
    this.trainPos = 0.5;

    this.game.audio.speak('Runaway train heading for the broken bridge! Shoot webs with BOTH hands and hold with all your strength!');
  }

  update(dt, handStates = []) {
    if (this.stopped || this.failed) return;

    // Check dual hand tracking
    const hand0 = handStates[0];
    const hand1 = handStates[1];

    let leftActive = false;
    let rightActive = false;

    [hand0, hand1].forEach(hand => {
      if (hand && hand.detected && (hand.gesture === 'SPIDERMAN' || hand.gesture === 'FIST')) {
        if (hand.wristScreen.x < 0.5) leftActive = true;
        else rightActive = true;
      }
    });

    this.leftHandWebbed = leftActive;
    this.rightHandWebbed = rightActive;

    // When both hands are active and pulling
    if (this.leftHandWebbed && this.rightHandWebbed) {
      this.tension = Math.min(100, this.tension + 35 * dt);
      const brakeForce = (this.tension / 100) * 38;
      this.trainSpeed = Math.max(0, this.trainSpeed - brakeForce * dt);

      // Strain SFX & screen shake
      this.strainSoundTimer += dt;
      if (this.strainSoundTimer > 0.25) {
        this.strainSoundTimer = 0;
        this.game.audio.playStretch();
        this.game.vfx.addShake(8 + (this.tension / 10));
      }

      // Spark particles from tracks
      this.sparkTimer += dt;
      if (this.sparkTimer > 0.05) {
        this.sparkTimer = 0;
        this.game.webEngine.spawnImpactDebris({ x: 0.35, y: 0.8 }, 'iron');
        this.game.webEngine.spawnImpactDebris({ x: 0.65, y: 0.8 }, 'iron');
      }

      if (this.trainSpeed <= 0) {
        this.stopped = true;
        this.game.audio.playExplosion(true);
        this.game.vfx.addComicText('TRAIN STOPPED!', 0.5, 0.5, { scale: 2.2 });
        this.game.audio.speak('You did it, Spider-Man! You saved everyone on board!');
      }
    } else {
      // Losing tension
      this.tension = Math.max(0, this.tension - 25 * dt);
    }

    // Distance decreases as train moves
    if (this.trainSpeed > 0) {
      this.distanceToCliff -= (this.trainSpeed * 0.28) * dt * 8;
      if (this.distanceToCliff <= 0) {
        this.distanceToCliff = 0;
        this.failed = true;
        this.game.audio.playExplosion(true);
        this.game.vfx.addComicText('CRASH!', 0.5, 0.5, { scale: 2.0 });
        this.game.audio.speak('The train went off the tracks! Try again!');
      }
    }
  }

  draw(ctx, width, height) {
    if (!ctx) return;

    // Draw Perspective Subway Train Tracks
    ctx.save();
    const trackY = height * 0.75;
    const vanishX = width * 0.5;
    const vanishY = height * 0.3;

    // Metal rails
    ctx.beginPath();
    ctx.moveTo(vanishX - 40, vanishY);
    ctx.lineTo(width * 0.15, height);
    ctx.moveTo(vanishX + 40, vanishY);
    ctx.lineTo(width * 0.85, height);
    ctx.strokeStyle = '#90a4ae';
    ctx.lineWidth = 8;
    ctx.stroke();

    // Wooden railway ties
    const numTies = 14;
    for (let i = 0; i < numTies; i++) {
      const frac = (i + (performance.now() * 0.002 * (this.trainSpeed / 50)) % 1) / numTies;
      const py = vanishY + (height - vanishY) * (frac ** 2);
      const spanW = 80 + (width * 0.7) * (frac ** 2);
      ctx.beginPath();
      ctx.moveTo(vanishX - spanW / 2, py);
      ctx.lineTo(vanishX + spanW / 2, py);
      ctx.strokeStyle = '#5d4037';
      ctx.lineWidth = 4 + frac * 8;
      ctx.stroke();
    }

    // Draw Subway Front Car (approaching camera)
    const trainScale = 1.0;
    const tw = width * 0.48;
    const th = height * 0.38;
    const tx = (width - tw) / 2;
    const ty = height * 0.45;

    // Subway train body
    ctx.fillStyle = '#b0bec5';
    ctx.fillRect(tx, ty, tw, th);
    ctx.strokeStyle = '#263238';
    ctx.lineWidth = 4;
    ctx.strokeRect(tx, ty, tw, th);

    // Front silver windshields
    ctx.fillStyle = '#1565c0';
    ctx.fillRect(tx + tw * 0.1, ty + th * 0.15, tw * 0.35, th * 0.35);
    ctx.fillRect(tx + tw * 0.55, ty + th * 0.15, tw * 0.35, th * 0.35);

    // Front high-beam headlights
    const hlGlow = ctx.createRadialGradient(tx + tw * 0.2, ty + th * 0.7, 10, tx + tw * 0.2, ty + th * 0.7, 80);
    hlGlow.addColorStop(0, '#ffffdd');
    hlGlow.addColorStop(1, 'rgba(255, 255, 200, 0)');
    ctx.fillStyle = hlGlow;
    ctx.beginPath();
    ctx.arc(tx + tw * 0.2, ty + th * 0.7, 80, 0, Math.PI * 2);
    ctx.fill();

    // Spidey Web Cables Attached to Sides of Train
    if (this.leftHandWebbed) {
      ctx.beginPath();
      ctx.moveTo(tx, ty + th * 0.5);
      ctx.lineTo(0, height * 0.2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 12;
      ctx.stroke();
    }

    if (this.rightHandWebbed) {
      ctx.beginPath();
      ctx.moveTo(tx + tw, ty + th * 0.5);
      ctx.lineTo(width, height * 0.2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 12;
      ctx.stroke();
    }

    // Tension & Train Speed HUD
    const hudW = Math.min(420, width * 0.8);
    const hudX = (width - hudW) / 2;

    // Tension Bar
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(hudX, 30, hudW, 24);
    ctx.strokeStyle = '#ff1744';
    ctx.lineWidth = 2;
    ctx.strokeRect(hudX, 30, hudW, 24);

    const tFill = (this.tension / 100) * hudW;
    const tGrad = ctx.createLinearGradient(hudX, 0, hudX + hudW, 0);
    tGrad.addColorStop(0, '#ffff00');
    tGrad.addColorStop(1, '#ff1744');
    ctx.fillStyle = tGrad;
    ctx.fillRect(hudX, 30, tFill, 24);

    ctx.font = '900 14px "Impact", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`WEB PULL STRAIN: ${Math.round(this.tension)}%`, width / 2, 47);

    // Speed & Distance to Cliff
    ctx.font = '900 20px "Impact", sans-serif';
    ctx.fillStyle = '#ffeb3b';
    ctx.textAlign = 'left';
    ctx.fillText(`SPEED: ${Math.round(this.trainSpeed)} KM/H`, hudX, 85);

    ctx.textAlign = 'right';
    ctx.fillStyle = this.distanceToCliff < 200 ? '#ff1744' : '#00e5ff';
    ctx.fillText(`CLIFF: ${Math.round(this.distanceToCliff)}M`, hudX + hudW, 85);

    // Hands guidance banner
    if (!this.stopped && !this.failed) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(hudX, height - 70, hudW, 40);
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(`Left Hand: ${this.leftHandWebbed ? 'WEB ATTACHED 🤟' : 'NEED 🤟 POSE'}  |  Right Hand: ${this.rightHandWebbed ? 'WEB ATTACHED 🤟' : 'NEED 🤟 POSE'}`, width / 2, height - 45);
    }

    ctx.restore();
  }
}

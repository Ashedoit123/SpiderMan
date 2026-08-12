// Movie-Accurate Spider-Man Web Shooter Audio Synthesizer
// Zero external files - 100% synthesized Web Audio API sound design

class MovieAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isMuted = false;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.9, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn('AudioContext error:', e);
    }
  }

  ensureContext() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Movie-accurate Spider-Man "THWIP!" Web Shoot Sound
  // Multi-layered: 1. Solenoid pneumatic pop, 2. Supersonic silk whip whizz, 3. High-Q resonant nozzle squirt
  playMovieThwip(style = 'classic') {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;

    // --- Layer 1: High-Pressure Pneumatic Gas Burst (The crisp "TH-" transient) ---
    const popBufferSize = Math.floor(this.ctx.sampleRate * 0.035);
    const popBuffer = this.ctx.createBuffer(1, popBufferSize, this.ctx.sampleRate);
    const popData = popBuffer.getChannelData(0);
    for (let i = 0; i < popBufferSize; i++) {
      popData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (popBufferSize * 0.25));
    }
    const popSource = this.ctx.createBufferSource();
    popSource.buffer = popBuffer;

    const popFilter = this.ctx.createBiquadFilter();
    popFilter.type = 'bandpass';
    popFilter.frequency.setValueAtTime(4200, t);
    popFilter.frequency.exponentialRampToValueAtTime(1800, t + 0.035);
    popFilter.Q.setValueAtTime(6.0, t);

    const popGain = this.ctx.createGain();
    popGain.gain.setValueAtTime(0.85, t);
    popGain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

    popSource.connect(popFilter);
    popFilter.connect(popGain);
    popGain.connect(this.masterGain);

    popSource.start(t);
    popSource.stop(t + 0.038);

    // --- Layer 2: Supersonic Silk Filament Whistle / Whip ("-WIPPPP!") ---
    const whipOsc = this.ctx.createOscillator();
    const whipGain = this.ctx.createGain();

    whipOsc.type = style === 'venom' ? 'sawtooth' : 'sine';
    whipOsc.frequency.setValueAtTime(2900, t);
    whipOsc.frequency.exponentialRampToValueAtTime(550, t + 0.095);

    whipGain.gain.setValueAtTime(0.001, t);
    whipGain.gain.linearRampToValueAtTime(0.7, t + 0.008);
    whipGain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);

    whipOsc.connect(whipGain);
    whipGain.connect(this.masterGain);

    whipOsc.start(t);
    whipOsc.stop(t + 0.12);

    // --- Layer 3: Resonant Nozzle Squirt (Acoustic cavity resonance) ---
    const rezOsc = this.ctx.createOscillator();
    const rezGain = this.ctx.createGain();

    rezOsc.type = 'triangle';
    rezOsc.frequency.setValueAtTime(1600, t);
    rezOsc.frequency.exponentialRampToValueAtTime(320, t + 0.08);

    rezGain.gain.setValueAtTime(0.45, t);
    rezGain.gain.exponentialRampToValueAtTime(0.001, t + 0.085);

    rezOsc.connect(rezGain);
    rezGain.connect(this.masterGain);

    rezOsc.start(t);
    rezOsc.stop(t + 0.09);

    // --- Optional Venom Zap Layer ---
    if (style === 'venom') {
      this.playElectricSparks(t);
    }
  }

  // Web Wall Impact / Splat ("THOCK / SPLAT")
  playImpactSound() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;

    // Deep low thump
    const thumpOsc = this.ctx.createOscillator();
    const thumpGain = this.ctx.createGain();

    thumpOsc.type = 'sine';
    thumpOsc.frequency.setValueAtTime(260, t);
    thumpOsc.frequency.exponentialRampToValueAtTime(55, t + 0.07);

    thumpGain.gain.setValueAtTime(0.65, t);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    thumpOsc.connect(thumpGain);
    thumpGain.connect(this.masterGain);

    thumpOsc.start(t);
    thumpOsc.stop(t + 0.075);

    // Wet slap noise
    const slapBufferSize = Math.floor(this.ctx.sampleRate * 0.05);
    const slapBuffer = this.ctx.createBuffer(1, slapBufferSize, this.ctx.sampleRate);
    const slapData = slapBuffer.getChannelData(0);
    for (let i = 0; i < slapBufferSize; i++) {
      slapData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (slapBufferSize * 0.3));
    }
    const slapSource = this.ctx.createBufferSource();
    slapBufferSource: slapSource.buffer = slapBuffer;

    const slapFilter = this.ctx.createBiquadFilter();
    slapFilter.type = 'lowpass';
    slapFilter.frequency.setValueAtTime(1400, t);
    slapFilter.frequency.exponentialRampToValueAtTime(300, t + 0.05);

    const slapGain = this.ctx.createGain();
    slapGain.gain.setValueAtTime(0.4, t);
    slapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    slapSource.connect(slapFilter);
    slapFilter.connect(slapGain);
    slapGain.connect(this.masterGain);

    slapSource.start(t);
    slapSource.stop(t + 0.055);
  }

  // Fist Grab / Web Tension Stretch Sound (When making a fist & pulling)
  playWebGrabSound() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;

    // Firm leather / rope clinch snap
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.06);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.065);
  }

  // Continuous Tension Pull Creak
  playTensionCreak(intensity = 0.5) {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    const baseFreq = 180 + intensity * 260;
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.linearRampToValueAtTime(baseFreq + 60, t + 0.08);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(baseFreq * 2, t);
    filter.Q.setValueAtTime(8, t);

    gain.gain.setValueAtTime(0.2 * Math.min(1, intensity), t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.095);
  }

  // Web Detach / Dissolve Snap
  playWebDissolveSound() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(850, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.08);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.085);
  }

  playElectricSparks(t) {
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1200 + Math.random() * 800, t + i * 0.02);
      osc.frequency.exponentialRampToValueAtTime(200, t + i * 0.02 + 0.04);

      g.gain.setValueAtTime(0.2, t + i * 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.02 + 0.04);

      osc.connect(g);
      g.connect(this.masterGain);

      osc.start(t + i * 0.02);
      osc.stop(t + i * 0.02 + 0.05);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.9, this.ctx.currentTime);
    }
    return this.isMuted;
  }
}

export const movieAudioEngine = new MovieAudioEngine();

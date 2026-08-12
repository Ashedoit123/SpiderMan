export class AudioBus {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfx = null;
    this.amb = null;
    this.buffers = new Map();
    this.muted = false;
    this.stretch = null;
    this.ready = false;
  }

  async init() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);

    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 0.95;
    this.sfx.connect(this.master);

    this.amb = this.ctx.createGain();
    this.amb.gain.value = 0.18;
    this.amb.connect(this.master);

    await Promise.all([
      this.load("fabba", "assets/sounds/fabba.mp3"),
      this.load("thwip", "assets/sounds/thwip.mp3"),
    ]);

    this.startAmbience();
    this.ready = true;
  }

  async resume() {
    if (this.ctx && this.ctx.state !== "running") await this.ctx.resume();
  }

  async load(name, url) {
    try {
      const res = await fetch(url);
      const arr = await res.arrayBuffer();
      const buf = await this.ctx.decodeAudioData(arr);
      this.buffers.set(name, buf);
    } catch (err) {
      console.warn("audio load fail", name, err);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  play(name, { volume = 1, playbackRate = 1, pan = 0 } = {}) {
    if (!this.ready) return;
    const buf = this.buffers.get(name);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = playbackRate;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    src.connect(g).connect(p).connect(this.sfx);
    src.start();
    return src;
  }

  shoot(type = "grapple", pan = 0) {
    if (this.buffers.has("fabba")) {
      this.play("fabba", {
        volume: 1,
        playbackRate: type === "impact" ? 0.9 + Math.random() * 0.08 : 0.96 + Math.random() * 0.1,
        pan,
      });
    } else {
      this.synthThwip(type);
    }
    if (type === "impact") {
      if (this.buffers.has("thwip")) {
        this.play("thwip", { volume: 0.55, playbackRate: 1.05 + Math.random() * 0.08, pan });
      }
      this.synthZap(pan);
    }
  }

  attach() {
    this.blip(180, 0.09, "triangle", 0.22);
    this.noiseBurst(0.06, 900, 0.12);
  }

  snap() {
    this.noiseBurst(0.09, 1400, 0.2);
    this.blip(320, 0.05, "square", 0.08);
  }

  impact(heavy = false) {
    this.noiseBurst(heavy ? 0.18 : 0.08, heavy ? 280 : 500, heavy ? 0.35 : 0.16);
    this.blip(heavy ? 70 : 140, 0.12, "sine", heavy ? 0.28 : 0.12);
  }

  ui(kind = "tick") {
    if (kind === "tick") this.blip(880, 0.04, "square", 0.04);
    if (kind === "ok") {
      this.blip(520, 0.06, "sine", 0.08);
      this.blip(780, 0.08, "sine", 0.06, 0.05);
    }
    if (kind === "warn") this.blip(220, 0.1, "sawtooth", 0.07);
    if (kind === "boot") {
      this.blip(196, 0.18, "sine", 0.1);
      this.blip(392, 0.22, "sine", 0.08, 0.08);
      this.blip(784, 0.3, "triangle", 0.06, 0.16);
    }
  }

  setTension(amount) {
    if (!this.ready) return;
    if (amount <= 0.05) {
      this.stopStretch();
      return;
    }
    if (!this.stretch) this.startStretch();
    const t = this.ctx.currentTime;
    this.stretch.gain.gain.setTargetAtTime(Math.min(0.16, amount * 0.14), t, 0.08);
    this.stretch.filter.frequency.setTargetAtTime(400 + amount * 1800, t, 0.08);
  }

  startStretch() {
    const ctx = this.ctx;
    const noise = this.whiteNoise(2);
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 700;
    filter.Q.value = 4.5;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    noise.connect(filter).connect(gain).connect(this.sfx);
    noise.start();
    this.stretch = { src: noise, filter, gain };
  }

  stopStretch() {
    if (!this.stretch) return;
    const t = this.ctx.currentTime;
    this.stretch.gain.gain.setTargetAtTime(0.0001, t, 0.06);
    const node = this.stretch;
    this.stretch = null;
    setTimeout(() => {
      try { node.src.stop(); } catch (_) { /* */ }
    }, 200);
  }

  startAmbience() {
    const ctx = this.ctx;
    const noise = this.whiteNoise(4);
    noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 280;
    const g = ctx.createGain();
    g.gain.value = 1;
    noise.connect(lp).connect(g).connect(this.amb);
    noise.start();

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 55;
    const og = ctx.createGain();
    og.gain.value = 0.15;
    osc.connect(og).connect(this.amb);
    osc.start();
  }

  synthThwip(type) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(type === "impact" ? 140 : 220, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.12);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(2200, t);
    f.frequency.exponentialRampToValueAtTime(280, t + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(f).connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.18);
    this.noiseBurst(0.08, 1600, 0.18);
  }

  synthZap(pan = 0) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.setValueAtTime(740, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    o.connect(g).connect(p).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.11);
  }

  blip(freq, dur, type, vol, delay = 0) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noiseBurst(dur, freq, vol) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = this.whiteNoise(dur + 0.05);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  whiteNoise(seconds) {
    const ctx = this.ctx;
    const n = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }
}

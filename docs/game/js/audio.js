// NEON PULSE — procedural Web Audio
// No audio files shipped — all sound is synthesised at runtime.

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.volume = 0.7;
    this._started = false;
  }

  _ensureContext() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
  }

  unlock() {
    // Must be called in a user gesture
    this._ensureContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this._started = true;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.volume;
  }

  setEnabled(on) {
    this.enabled = !!on;
  }

  _now() { return this.ctx ? this.ctx.currentTime : 0; }

  _beep({ freq = 440, duration = 0.08, type = 'sine', attack = 0.005, decay = 0.08, gain = 0.3, slide = 0 }) {
    if (!this.enabled || !this._started) return;
    this._ensureContext();
    if (!this.ctx) return;
    const t = this._now();
    const osc = this.ctx.createOscillator();
    const g   = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide !== 0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + duration);
    }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + attack + decay + 0.02);
  }

  _getNoiseBuffer() {
    // Cached 1-second white-noise buffer — previously we allocated
    // a new Float32Array every SFX. Shared AudioBuffer is reusable.
    if (this._noiseBuffer) return this._noiseBuffer;
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, sr, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < sr; i++) d[i] = Math.random() * 2 - 1;
    this._noiseBuffer = buf;
    return buf;
  }

  _noise({ duration = 0.2, gain = 0.2, filterFreq = 800, filterQ = 1 }) {
    if (!this.enabled || !this._started) return;
    this._ensureContext();
    if (!this.ctx) return;
    const t = this._now();
    const src = this.ctx.createBufferSource();
    src.buffer = this._getNoiseBuffer();
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = filterQ;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + duration + 0.02);
  }

  // ─── Sound palette ────────────────────────
  dashCharge()   { this._beep({ freq: 220, duration: 0.35, type: 'sawtooth', gain: 0.08, slide: 400, decay: 0.35 }); }
  dashFire()     { this._beep({ freq: 900, duration: 0.12, type: 'square', gain: 0.25, slide: -600, decay: 0.1 }); }
  enemyHit()     { this._beep({ freq: 600, duration: 0.05, type: 'triangle', gain: 0.25, slide: -200, decay: 0.05 });
                   this._noise({ duration: 0.06, gain: 0.1, filterFreq: 1500 }); }
  enemyDie()     { this._beep({ freq: 180, duration: 0.2, type: 'sawtooth', gain: 0.18, slide: -120, decay: 0.2 });
                   this._noise({ duration: 0.15, gain: 0.15, filterFreq: 600 }); }
  playerHit()    { this._beep({ freq: 90, duration: 0.3, type: 'sawtooth', gain: 0.35, slide: -60, decay: 0.3 });
                   this._noise({ duration: 0.35, gain: 0.25, filterFreq: 200 }); }
  combo(level)   { this._beep({ freq: 440 + level * 60, duration: 0.09, type: 'triangle', gain: 0.18, decay: 0.09 }); }
  upgrade()      { this._beep({ freq: 523, duration: 0.12, type: 'sine', gain: 0.22, decay: 0.12 });
                   setTimeout(() => this._beep({ freq: 659, duration: 0.12, type: 'sine', gain: 0.22, decay: 0.12 }), 70);
                   setTimeout(() => this._beep({ freq: 784, duration: 0.16, type: 'sine', gain: 0.25, decay: 0.16 }), 140); }
  menuMove()     { this._beep({ freq: 800, duration: 0.04, type: 'triangle', gain: 0.08, decay: 0.04 }); }
  menuSelect()   { this._beep({ freq: 1200, duration: 0.06, type: 'square', gain: 0.12, decay: 0.06 }); }
  arenaStart()   { this._beep({ freq: 110, duration: 0.4, type: 'sawtooth', gain: 0.3, slide: 200, decay: 0.4 }); }
  gameOver()     { this._beep({ freq: 240, duration: 0.8, type: 'sawtooth', gain: 0.35, slide: -180, decay: 0.8 }); }
  achievement()  { this._beep({ freq: 784, duration: 0.15, type: 'sine', gain: 0.25, decay: 0.15 });
                   setTimeout(() => this._beep({ freq: 1047, duration: 0.25, type: 'sine', gain: 0.3, decay: 0.25 }), 130); }
  // Ambient synth drone for the menu
  startAmbient() {
    if (!this.enabled || !this._started) return;
    this._ensureContext();
    if (!this.ctx || this._ambient) return;
    const t = this._now();
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const lfo  = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const g = this.ctx.createGain();
    osc1.type = 'sine'; osc1.frequency.value = 55;
    osc2.type = 'sawtooth'; osc2.frequency.value = 55.3;
    lfo.type = 'sine'; lfo.frequency.value = 0.15;
    lfoGain.gain.value = 0.04;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    g.gain.value = 0.05;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    osc1.start(t); osc2.start(t); lfo.start(t);
    this._ambient = { osc1, osc2, lfo, g };
  }
  stopAmbient() {
    if (!this._ambient || !this.ctx) return;
    const t = this._now();
    this._ambient.g.gain.linearRampToValueAtTime(0, t + 0.5);
    this._ambient.osc1.stop(t + 0.6);
    this._ambient.osc2.stop(t + 0.6);
    this._ambient.lfo.stop(t + 0.6);
    this._ambient = null;
  }
}

window.AudioEngine = AudioEngine;

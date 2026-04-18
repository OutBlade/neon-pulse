// NEON PULSE — local persistence layer
// Wraps localStorage with versioned, typed access and default values.

const STORAGE_KEY = 'neon-pulse:v1';

const DEFAULTS = {
  settings: {
    masterVolume: 0.7,
    sfx: true,
    screenShake: true,
    chromaticAberration: true,
    particles: true,
    crtFilter: true,
    fpsCap: 0, // 0 = uncapped, otherwise 30/60/120/144
  },
  stats: {
    totalRuns: 0,
    totalKills: 0,
    totalDashes: 0,
    bestScore: 0,
    bestCombo: 0,
    bestArena: 0,
    totalPlaytimeSec: 0,
  },
  achievements: {},  // id → true
};

function deepMerge(a, b) {
  const out = { ...a };
  for (const k of Object.keys(b || {})) {
    if (typeof b[k] === 'object' && b[k] !== null && !Array.isArray(b[k])) {
      out[k] = deepMerge(a[k] || {}, b[k]);
    } else {
      out[k] = b[k];
    }
  }
  return out;
}

class Storage {
  constructor() {
    this.state = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULTS);
      const parsed = JSON.parse(raw);
      return deepMerge(structuredClone(DEFAULTS), parsed);
    } catch (e) {
      console.warn('[storage] corrupt save, resetting', e);
      return structuredClone(DEFAULTS);
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn('[storage] save failed', e);
    }
  }

  get settings() { return this.state.settings; }
  get stats()    { return this.state.stats; }
  get achievements() { return this.state.achievements; }

  setSetting(key, value) {
    this.state.settings[key] = value;
    this.save();
  }

  recordRun(result) {
    // result: { score, kills, dashes, combo, arena, playtimeSec }
    const s = this.state.stats;
    s.totalRuns   += 1;
    s.totalKills  += (result.kills   || 0);
    s.totalDashes += (result.dashes  || 0);
    s.totalPlaytimeSec += (result.playtimeSec || 0);
    let newBest = false;
    if (result.score > s.bestScore) { s.bestScore = result.score; newBest = true; }
    if (result.combo > s.bestCombo) { s.bestCombo = result.combo; }
    if (result.arena > s.bestArena) { s.bestArena = result.arena; }
    this.save();
    return newBest;
  }

  unlockAchievement(id) {
    if (this.state.achievements[id]) return false;
    this.state.achievements[id] = Date.now();
    this.save();
    return true;
  }

  hasAchievement(id) {
    return !!this.state.achievements[id];
  }

  resetAll() {
    this.state = structuredClone(DEFAULTS);
    this.save();
  }
}

window.Storage = Storage;

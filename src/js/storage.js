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
  customArenas: {},  // id → arenaDef (see src/js/forge.js for schema)
  arenaScores:  {},  // arenaId → { bestScore, bestWave, runs }
  brainrot: {
    auraPoints:     0,    // lifetime AP (never resets)
    auraLevel:      0,    // derived from AP but cached for UI
    lifetimeKills:  0,    // brainrot-mode-only kills
    bestScore:      0,
    bestStreak:     0,
    bestKills:      0,
    runsPlayed:     0,
    jackpotsHit:    0,
    lastPlayDay:    null, // YYYY-MM-DD
    streakDays:     0,    // consecutive daily play streak
    unlockedLabels: [],   // ids of unlocked-by-level meme labels
  },
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

  // ── Custom arenas (Workshop / Forge) ────────
  get customArenas() { return this.state.customArenas || {}; }
  saveCustomArena(def) {
    if (!def || !def.id) return false;
    this.state.customArenas[def.id] = def;
    this.save();
    return true;
  }
  deleteCustomArena(id) {
    if (this.state.customArenas[id]) {
      delete this.state.customArenas[id];
      this.save();
      return true;
    }
    return false;
  }
  recordArenaRun(arenaId, runResult) {
    if (!arenaId) return false;
    const rec = this.state.arenaScores[arenaId] || { bestScore: 0, bestWave: 0, runs: 0 };
    rec.runs += 1;
    let newBest = false;
    if (runResult.score > rec.bestScore) { rec.bestScore = runResult.score; newBest = true; }
    if (runResult.wave > rec.bestWave)   { rec.bestWave  = runResult.wave; }
    this.state.arenaScores[arenaId] = rec;
    this.save();
    return newBest;
  }
  getArenaScore(arenaId) {
    return this.state.arenaScores[arenaId] || { bestScore: 0, bestWave: 0, runs: 0 };
  }

  // ── BRAINROT meta ────────────────────────────
  get brainrot() { return this.state.brainrot; }

  // AP required to hit level N (0-indexed). Gentle curve, fast early
  // dopamine hits. Level 1 = 100 AP, 5 = 1150, 10 = 3400, 20 = 12800.
  auraLevelThreshold(n) { return Math.floor(100 * Math.pow(n + 1, 1.45)); }
  auraLevelFromAP(ap) {
    let lvl = 0;
    while (ap >= this.auraLevelThreshold(lvl)) lvl += 1;
    return lvl;
  }
  addAura(n) {
    const br = this.state.brainrot;
    const prevLevel = br.auraLevel;
    br.auraPoints += n;
    const newLevel = this.auraLevelFromAP(br.auraPoints);
    const leveledUp = newLevel > prevLevel;
    br.auraLevel = newLevel;
    this.save();
    return { leveledUp, newLevel, gained: n, total: br.auraPoints };
  }
  recordBrainrotRun(result) {
    // result: { score, kills, streak, jackpots, apGained }
    const br = this.state.brainrot;
    br.runsPlayed    += 1;
    br.lifetimeKills += (result.kills    || 0);
    br.jackpotsHit   += (result.jackpots || 0);
    let newBest = false;
    if (result.score  > br.bestScore)  { br.bestScore  = result.score;  newBest = true; }
    if (result.streak > br.bestStreak) { br.bestStreak = result.streak; }
    if (result.kills  > br.bestKills)  { br.bestKills  = result.kills;  }
    this.save();
    return newBest;
  }
  // Checks & updates the daily-play streak. Returns how many days in a row
  // the player has opened brainrot mode (including today). Also returns
  // whether today was already counted so callers can avoid re-awarding.
  checkBrainrotDaily() {
    const br = this.state.brainrot;
    const today = new Date().toISOString().slice(0, 10);
    if (br.lastPlayDay === today) {
      return { streak: br.streakDays, freshToday: false };
    }
    // Is yesterday's date the last-play-day? → continue streak
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yesterday = y.toISOString().slice(0, 10);
    br.streakDays = (br.lastPlayDay === yesterday) ? (br.streakDays + 1) : 1;
    br.lastPlayDay = today;
    this.save();
    return { streak: br.streakDays, freshToday: true };
  }
  unlockLabel(id) {
    const br = this.state.brainrot;
    if (br.unlockedLabels.includes(id)) return false;
    br.unlockedLabels.push(id);
    this.save();
    return true;
  }
}

window.Storage = Storage;

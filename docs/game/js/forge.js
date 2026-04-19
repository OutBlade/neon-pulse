// NEON PULSE — Workshop / Arena Forge
// User-generated arena editor + Workshop browser + share-code codec.
//
// SCHEMA  (v1)
// An arena is a JSON object:
//   {
//     v:    1,
//     id:   string,             unique id (local uid or share hash)
//     name: string,             display name, 32 char max
//     author: string,           64 char max
//     desc: string,             140 char max
//     rules: {
//       lives:           int 1..5,
//       enemySpeedMult:  float 0.5..2.5,
//       scoreMult:       float 0.5..3.0,
//       startingUpgrades: string[]   (ids from UPGRADES in game.js)
//     },
//     waves: [
//       {
//         name:      string,
//         duration:  int seconds 8..60,
//         count:     int enemies to spawn this wave 3..40,
//         pool:      string[]  ("basic" | "fast" | "tank" | "shooter" | "splitter"),
//         boss:      boolean (if true, count/pool ignored — spawn boss)
//       }
//     ]
//   }
//
// SHARE CODE FORMAT
//   "NP1:" + urlSafeBase64(JSON.stringify(arena))
// Prefix identifies schema version; payload is portable plain-text so users
// can paste into Discord, tweets, emails, anywhere.

(() => {

// ─────────────────────────────────────────────────────
// FEATURED starter arenas  (immutable seeds — demonstrate what's possible)
// ─────────────────────────────────────────────────────
const FEATURED = [
  {
    v: 1, id: 'f_bullet_hell',
    name: 'BULLET HELL', author: 'OutBlade',
    desc: 'Shooters only. Dodge everything. Mental.',
    rules: { lives: 3, enemySpeedMult: 0.9, scoreMult: 1.5, startingUpgrades: ['pulse_width'] },
    waves: [
      { name: 'WARMUP',     duration: 20, count: 8,  pool: ['shooter'] },
      { name: 'CROSSFIRE',  duration: 25, count: 14, pool: ['shooter'] },
      { name: 'WALL OF DEATH', duration: 30, count: 20, pool: ['shooter','fast'] },
      { name: 'APEX',       duration: 22, count: 0,  pool: [], boss: true },
    ],
  },
  {
    v: 1, id: 'f_blender',
    name: 'THE BLENDER', author: 'OutBlade',
    desc: '40-enemy splitter soup. Multi-kills guaranteed.',
    rules: { lives: 3, enemySpeedMult: 1.0, scoreMult: 2.0, startingUpgrades: ['pulse_width','dash_range'] },
    waves: [
      { name: 'PULP',   duration: 25, count: 18, pool: ['splitter'] },
      { name: 'PUREE',  duration: 28, count: 26, pool: ['splitter','basic'] },
      { name: 'SMOOTHIE', duration: 30, count: 32, pool: ['splitter','fast'] },
    ],
  },
  {
    v: 1, id: 'f_speedrun',
    name: 'SPEEDRUN ANY%', author: 'OutBlade',
    desc: 'Everything is 60% faster. Score x3. GO.',
    rules: { lives: 2, enemySpeedMult: 1.6, scoreMult: 3.0, startingUpgrades: ['dash_cd','charge_speed'] },
    waves: [
      { name: 'GO',      duration: 15, count: 10, pool: ['basic','fast'] },
      { name: 'FASTER',  duration: 15, count: 14, pool: ['fast'] },
      { name: 'BLUR',    duration: 15, count: 18, pool: ['fast','splitter'] },
      { name: 'PEAK',    duration: 20, count: 0,  pool: [], boss: true },
    ],
  },
];

// ─────────────────────────────────────────────────────
// SHARE CODE  encode / decode
// ─────────────────────────────────────────────────────
function b64urlEncode(str) {
  // btoa handles latin-1 only; encodeURIComponent first, then strip URL-unsafe chars
  const raw = btoa(unescape(encodeURIComponent(str)));
  return raw.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const raw = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return decodeURIComponent(escape(raw));
}
function encodeArena(def) {
  // Strip runtime-only fields
  const slim = {
    v: 1,
    name: def.name, author: def.author, desc: def.desc,
    rules: def.rules, waves: def.waves,
  };
  return 'NP1:' + b64urlEncode(JSON.stringify(slim));
}
function decodeArena(code) {
  if (!code || typeof code !== 'string') throw new Error('empty code');
  const trimmed = code.trim();
  if (!trimmed.startsWith('NP1:')) throw new Error('not a Neon Pulse arena code');
  const json = b64urlDecode(trimmed.slice(4));
  const obj = JSON.parse(json);
  const validated = validate(obj);
  validated.id = 'a_' + hashCode(trimmed);   // deterministic id from code
  return validated;
}
function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

// ─────────────────────────────────────────────────────
// VALIDATION  (defensive — never trust imported data)
// ─────────────────────────────────────────────────────
const VALID_TYPES = new Set(['basic','fast','tank','shooter','splitter']);
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function validate(raw) {
  if (!raw || raw.v !== 1) throw new Error('unsupported schema version');
  const def = {
    v: 1,
    id: String(raw.id || ('a_' + Math.random().toString(36).slice(2, 10))),
    name: String(raw.name || 'UNTITLED').slice(0, 32),
    author: String(raw.author || 'anon').slice(0, 64),
    desc: String(raw.desc || '').slice(0, 140),
    rules: {
      lives: clamp(parseInt(raw.rules?.lives, 10) || 3, 1, 5),
      enemySpeedMult: clamp(parseFloat(raw.rules?.enemySpeedMult) || 1.0, 0.5, 2.5),
      scoreMult:      clamp(parseFloat(raw.rules?.scoreMult) || 1.0, 0.5, 3.0),
      startingUpgrades: Array.isArray(raw.rules?.startingUpgrades) ? raw.rules.startingUpgrades.slice(0, 5) : [],
    },
    waves: [],
  };
  if (!Array.isArray(raw.waves) || !raw.waves.length) throw new Error('arena has no waves');
  for (const w of raw.waves.slice(0, 10)) {
    def.waves.push({
      name: String(w.name || 'WAVE').slice(0, 24),
      duration: clamp(parseInt(w.duration, 10) || 20, 8, 60),
      count:    clamp(parseInt(w.count, 10) || 10, 0, 40),
      pool:     Array.isArray(w.pool) ? w.pool.filter(t => VALID_TYPES.has(t)).slice(0, 5) : ['basic'],
      boss:     !!w.boss,
    });
  }
  return def;
}

function newId() { return 'a_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function blankArena() {
  return {
    v: 1, id: newId(),
    name: 'MY ARENA', author: 'you', desc: 'describe your creation',
    rules: { lives: 3, enemySpeedMult: 1.0, scoreMult: 1.0, startingUpgrades: [] },
    waves: [
      { name: 'WAVE 01', duration: 20, count: 10, pool: ['basic'] },
      { name: 'WAVE 02', duration: 25, count: 14, pool: ['basic','fast'] },
      { name: 'WAVE 03', duration: 30, count: 18, pool: ['basic','fast','tank'] },
    ],
  };
}

// ─────────────────────────────────────────────────────
// DOM — Workshop + Forge wiring
// ─────────────────────────────────────────────────────
let currentEditing = null;

function listAllArenas(storage) {
  const user = Object.values(storage.customArenas);
  return { featured: FEATURED, user };
}

function renderWorkshop(storage, onPlay) {
  const featEl = document.getElementById('ws-featured-list');
  const userEl = document.getElementById('ws-user-list');
  const { featured, user } = listAllArenas(storage);
  featEl.innerHTML = '';
  for (const a of featured) featEl.appendChild(arenaCard(a, storage, onPlay, { featured: true }));
  userEl.innerHTML = '';
  if (!user.length) {
    userEl.innerHTML = `<div class="ws-empty">No custom arenas yet. Open the FORGE to make one, or paste a share code to import.</div>`;
  } else {
    for (const a of user) userEl.appendChild(arenaCard(a, storage, onPlay, { featured: false }));
  }
}
function arenaCard(a, storage, onPlay, opts) {
  const card = document.createElement('div');
  card.className = 'ws-card' + (opts.featured ? ' featured' : '');
  const rec = storage.getArenaScore(a.id);
  const scoreTxt = rec.runs > 0 ? `BEST ${rec.bestScore.toLocaleString()} · WAVE ${rec.bestWave}` : 'no attempts yet';
  card.innerHTML = `
    <div class="ws-card-head">
      <div class="ws-card-title">${escapeHtml(a.name)}</div>
      <div class="ws-card-author">by ${escapeHtml(a.author)}</div>
    </div>
    <div class="ws-card-desc">${escapeHtml(a.desc || '')}</div>
    <div class="ws-card-meta">
      <span>${a.waves.length} waves</span>
      <span>lives ${a.rules.lives}</span>
      <span>score x${a.rules.scoreMult}</span>
    </div>
    <div class="ws-card-score">${scoreTxt}</div>
    <div class="ws-card-actions">
      <button class="btn-ghost" data-act="play">PLAY</button>
      <button class="btn-ghost" data-act="share">COPY CODE</button>
      ${opts.featured ? '' : '<button class="btn-ghost" data-act="edit">EDIT</button><button class="btn-ghost" data-act="del">DELETE</button>'}
    </div>
  `;
  card.querySelector('[data-act="play"]').addEventListener('click', () => onPlay(a));
  card.querySelector('[data-act="share"]').addEventListener('click', () => {
    const code = encodeArena(a);
    navigator.clipboard.writeText(code).then(() => {
      window.NEON.toast({ name: 'Share code copied!' });
    });
  });
  if (!opts.featured) {
    card.querySelector('[data-act="edit"]').addEventListener('click', () => openForge(a, storage, () => renderWorkshop(storage, onPlay)));
    card.querySelector('[data-act="del"]').addEventListener('click', () => {
      if (confirm(`Delete "${a.name}"?`)) {
        storage.deleteCustomArena(a.id);
        renderWorkshop(storage, onPlay);
      }
    });
  }
  return card;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ─────────────────────────────────────────────────────
// FORGE editor
// ─────────────────────────────────────────────────────
const ENEMY_TYPES = ['basic','fast','tank','shooter','splitter'];

function openForge(def, storage, onClose) {
  currentEditing = def ? JSON.parse(JSON.stringify(def)) : blankArena();
  document.getElementById('screen-forge').classList.add('active');
  document.querySelectorAll('.screen').forEach(s => {
    if (s.id !== 'screen-forge') s.classList.remove('active');
  });
  renderForge(storage, onClose);
}

function renderForge(storage, onClose) {
  const a = currentEditing;
  const root = document.getElementById('forge-body');
  root.innerHTML = `
    <div class="forge-row">
      <label>NAME</label>
      <input type="text" id="fg-name" value="${escapeHtml(a.name)}" maxlength="32">
    </div>
    <div class="forge-row">
      <label>AUTHOR</label>
      <input type="text" id="fg-author" value="${escapeHtml(a.author)}" maxlength="64">
    </div>
    <div class="forge-row">
      <label>DESCRIPTION</label>
      <input type="text" id="fg-desc" value="${escapeHtml(a.desc)}" maxlength="140">
    </div>
    <div class="forge-row-group">
      <div class="forge-row small">
        <label>LIVES</label>
        <input type="number" id="fg-lives" value="${a.rules.lives}" min="1" max="5">
      </div>
      <div class="forge-row small">
        <label>ENEMY SPEED</label>
        <input type="number" id="fg-espd" value="${a.rules.enemySpeedMult}" min="0.5" max="2.5" step="0.1">
      </div>
      <div class="forge-row small">
        <label>SCORE x</label>
        <input type="number" id="fg-smult" value="${a.rules.scoreMult}" min="0.5" max="3.0" step="0.1">
      </div>
    </div>
    <div class="forge-waves">
      <div class="forge-waves-head">
        <span>WAVES</span>
        <button class="btn-ghost small" id="fg-add-wave">+ ADD WAVE</button>
      </div>
      <div id="fg-wave-list"></div>
    </div>
  `;
  const list = document.getElementById('fg-wave-list');
  a.waves.forEach((w, i) => list.appendChild(waveRow(w, i)));
  document.getElementById('fg-add-wave').addEventListener('click', () => {
    if (a.waves.length >= 10) return;
    a.waves.push({ name: 'WAVE ' + String(a.waves.length + 1).padStart(2,'0'), duration: 20, count: 10, pool: ['basic'] });
    renderForge(storage, onClose);
  });

  // Save/cancel
  const saveBtn = document.getElementById('forge-save');
  saveBtn.onclick = () => {
    readFields();
    try {
      const validated = validate(a);
      validated.id = a.id;
      storage.saveCustomArena(validated);
      window.NEON.toast({ name: 'Arena saved!' });
      document.getElementById('screen-forge').classList.remove('active');
      document.getElementById('screen-workshop').classList.add('active');
      if (onClose) onClose();
    } catch (err) {
      alert('Cannot save: ' + err.message);
    }
  };
  const shareBtn = document.getElementById('forge-share');
  shareBtn.onclick = () => {
    readFields();
    try {
      const code = encodeArena(validate(a));
      navigator.clipboard.writeText(code).then(() => {
        window.NEON.toast({ name: 'Share code copied!' });
      });
    } catch (err) {
      alert('Cannot generate code: ' + err.message);
    }
  };
  const cancelBtn = document.getElementById('forge-cancel');
  cancelBtn.onclick = () => {
    document.getElementById('screen-forge').classList.remove('active');
    document.getElementById('screen-workshop').classList.add('active');
  };

  function readFields() {
    a.name = document.getElementById('fg-name').value || 'UNTITLED';
    a.author = document.getElementById('fg-author').value || 'anon';
    a.desc = document.getElementById('fg-desc').value;
    a.rules.lives = parseInt(document.getElementById('fg-lives').value, 10) || 3;
    a.rules.enemySpeedMult = parseFloat(document.getElementById('fg-espd').value) || 1.0;
    a.rules.scoreMult = parseFloat(document.getElementById('fg-smult').value) || 1.0;
    list.querySelectorAll('.forge-wave').forEach((el, i) => {
      const w = a.waves[i];
      w.name     = el.querySelector('[data-f="name"]').value;
      w.duration = parseInt(el.querySelector('[data-f="duration"]').value, 10) || 20;
      w.count    = parseInt(el.querySelector('[data-f="count"]').value, 10) || 10;
      w.pool     = ENEMY_TYPES.filter(t => el.querySelector(`[data-pool="${t}"]`).checked);
      w.boss     = el.querySelector('[data-f="boss"]').checked;
    });
  }
}

function waveRow(w, i) {
  const el = document.createElement('div');
  el.className = 'forge-wave';
  el.innerHTML = `
    <div class="fw-head">
      <span class="fw-num">#${String(i+1).padStart(2,'0')}</span>
      <input type="text" data-f="name" value="${escapeHtml(w.name)}" maxlength="24">
      <label class="fw-boss"><input type="checkbox" data-f="boss" ${w.boss?'checked':''}> BOSS</label>
      <button class="btn-ghost small" data-act="del">×</button>
    </div>
    <div class="fw-body">
      <label>DURATION<input type="number" data-f="duration" min="8" max="60" value="${w.duration}"></label>
      <label>COUNT<input type="number" data-f="count" min="0" max="40" value="${w.count}"></label>
      <div class="fw-pool">
        ${ENEMY_TYPES.map(t => `<label class="fw-chip"><input type="checkbox" data-pool="${t}" ${w.pool.includes(t)?'checked':''}>${t}</label>`).join('')}
      </div>
    </div>
  `;
  el.querySelector('[data-act="del"]').addEventListener('click', () => {
    if (currentEditing.waves.length <= 1) return;
    currentEditing.waves.splice(i, 1);
    const storage = window.NEON.storage;
    renderForge(storage);
  });
  return el;
}

// ─────────────────────────────────────────────────────
// PASTE code import dialog
// ─────────────────────────────────────────────────────
function openImportDialog(storage, onAfter) {
  const code = prompt('Paste a Neon Pulse share code (starts with "NP1:"):');
  if (!code) return;
  try {
    const def = decodeArena(code);
    // Clone with fresh local id so it becomes user-owned
    def.id = newId();
    storage.saveCustomArena(def);
    window.NEON.toast({ name: 'Imported: ' + def.name });
    if (onAfter) onAfter();
  } catch (err) {
    alert('Could not import: ' + err.message);
  }
}

// ─────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────
window.NeonForge = {
  FEATURED,
  encodeArena, decodeArena, validate, blankArena, newId,
  renderWorkshop, openForge, openImportDialog,
};

})();

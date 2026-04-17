// NEON PULSE — Core game engine
// Precision-dash roguelike. Mouse aims, hold LMB to charge, release to dash.

(() => {

// ─────────────────────────────────────────────────────
// CONFIG  (all tunable values live here)
// ─────────────────────────────────────────────────────
const CFG = {
  // arena
  ARENA_RADIUS_FACTOR: 0.42, // relative to min(canvas_w, canvas_h)

  // player
  PLAYER_RADIUS:   10,
  PLAYER_LIVES:    3,
  IFRAMES_MS:      1200,
  AUTO_MOVE_SPEED: 1.4,       // slow drift toward cursor when not dashing
  FRICTION:        0.88,

  // dash
  DASH_CHARGE_MIN_MS: 120,
  DASH_CHARGE_MAX_MS: 900,
  DASH_DISTANCE_MIN:  140,
  DASH_DISTANCE_MAX:  420,
  DASH_SPEED:         22,
  DASH_COOLDOWN_MS:   360,

  // enemies
  ENEMY_SPAWN_MARGIN: 60,
  BASIC_SPEED:        1.3,
  BASIC_RADIUS:       11,
  BASIC_HP:           1,

  FAST_SPEED:         2.4,
  FAST_RADIUS:        9,
  FAST_HP:            1,

  TANK_SPEED:         0.9,
  TANK_RADIUS:        18,
  TANK_HP:            3,

  SHOOTER_SPEED:      0.6,
  SHOOTER_RADIUS:     11,
  SHOOTER_HP:         1,
  SHOOTER_FIRE_MS:    2400,
  SHOOTER_PROJ_SPEED: 4.5,
  SHOOTER_STOP_DIST:  260,

  SPLITTER_SPEED:     1.1,
  SPLITTER_RADIUS:    16,
  SPLITTER_HP:        2,

  // waves / arenas
  ARENA_DURATION_SEC: 28,        // time to survive per arena
  ARENA_ENEMY_BASE:   12,
  ARENA_ENEMY_SCALE:  6,
  MAX_ON_SCREEN:      32,

  // combo
  COMBO_DECAY_MS: 2000,

  // scoring
  SCORE_BASIC:    50,
  SCORE_FAST:     80,
  SCORE_TANK:     200,
  SCORE_SHOOTER:  120,
  SCORE_SPLITTER: 150,
  SCORE_BABY:     40,
  ARENA_CLEAR_BONUS: 500,

  // visuals
  SHAKE_DECAY:        0.82,
  PARTICLE_COUNT_HIT: 12,
  PARTICLE_COUNT_DIE: 22,

  // colors
  COLORS: {
    player:   '#f7f7ff',
    playerGlow: '#05d9e8',
    dashTrail: '#ff2a6d',
    arena:    '#05d9e8',
    basic:    '#05d9e8',
    fast:     '#ffff66',
    tank:     '#b967ff',
    shooter:  '#ff2a6d',
    splitter: '#ff7a1c',
    baby:     '#ffaa88',
    projectile: '#ff2a6d',
    xp:       '#05d9e8',
  },
};

// ─────────────────────────────────────────────────────
// UPGRADE DEFINITIONS
// ─────────────────────────────────────────────────────
const UPGRADES = [
  // common
  { id: 'dash_range',   rarity: 'common', name: 'Extended Arc',    desc: 'Dash distance +25%.',               max: 4,
    apply: s => s.dashDistanceMult *= 1.25 },
  { id: 'dash_cd',      rarity: 'common', name: 'Quick Recovery',  desc: 'Dash cooldown -20%.',              max: 4,
    apply: s => s.dashCooldownMult *= 0.80 },
  { id: 'charge_speed', rarity: 'common', name: 'Rapid Charge',    desc: 'Charge time -25%.',                max: 3,
    apply: s => s.chargeSpeedMult *= 0.75 },
  { id: 'pulse_width',  rarity: 'common', name: 'Wider Pulse',     desc: 'Dash hit radius +40%.',            max: 3,
    apply: s => s.dashRadiusMult *= 1.4 },
  { id: 'combo_keeper', rarity: 'common', name: 'Momentum',        desc: 'Combo decay +50% slower.',         max: 2,
    apply: s => s.comboDecayMult *= 1.5 },

  // rare
  { id: 'shockwave',    rarity: 'rare',   name: 'Shockwave',       desc: 'Dash end emits a damaging shockwave.', max: 3,
    apply: s => s.shockwaveLevel += 1 },
  { id: 'pierce',       rarity: 'rare',   name: 'Piercing Pulse',  desc: 'Dash can no longer be stopped — plows through.', max: 1,
    apply: s => s.pierce = true },
  { id: 'double_dash',  rarity: 'rare',   name: 'Second Wind',     desc: 'Gain a second dash charge.',       max: 2,
    apply: s => s.maxCharges += 1 },
  { id: 'slowmo',       rarity: 'rare',   name: 'Temporal Field',  desc: 'Time slows while charging.',       max: 1,
    apply: s => s.slowmo = true },
  { id: 'magnet',       rarity: 'rare',   name: 'Magnetic Field',  desc: 'Pull score orbs from further away.', max: 2,
    apply: s => s.magnetMult *= 1.8 },

  // legendary
  { id: 'overdrive',    rarity: 'legendary', name: 'Overdrive',    desc: 'Every 5th kill refunds a dash charge.', max: 1,
    apply: s => s.overdrive = true },
  { id: 'echo',         rarity: 'legendary', name: 'Echo',         desc: 'Dashes leave a phantom that also damages enemies.', max: 1,
    apply: s => s.echo = true },
  { id: 'ghost',        rarity: 'legendary', name: 'Ghost Protocol', desc: 'i-frames last 2× longer.',        max: 1,
    apply: s => s.iframeMult *= 2.0 },
  { id: 'scavenger',    rarity: 'legendary', name: 'Scavenger',    desc: 'Every arena starts with +1 life (max 5).', max: 1,
    apply: s => s.scavenger = true },
];

const RARITY_WEIGHTS = { common: 70, rare: 25, legendary: 5 };

function rollUpgrades(picks = 3, ownedMap) {
  const pool = UPGRADES.filter(u => (ownedMap[u.id] || 0) < u.max);
  const out = [];
  const used = new Set();
  let guard = 100;
  while (out.length < picks && guard-- > 0) {
    // rarity roll
    const r = Math.random() * 100;
    let rarity;
    if (r < RARITY_WEIGHTS.legendary) rarity = 'legendary';
    else if (r < RARITY_WEIGHTS.legendary + RARITY_WEIGHTS.rare) rarity = 'rare';
    else rarity = 'common';
    const tier = pool.filter(u => u.rarity === rarity && !used.has(u.id));
    const candidates = tier.length ? tier : pool.filter(u => !used.has(u.id));
    if (!candidates.length) break;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    used.add(pick.id);
    out.push(pick);
  }
  return out;
}

// ─────────────────────────────────────────────────────
// GAME STATE
// ─────────────────────────────────────────────────────
let canvas, ctx, W, H;
let running = false;
let paused  = false;
let onExit  = null;

let player;
let stats;      // loadout/upgrade modifiers for current run
let ownedUpgrades; // id → count
let enemies, projectiles, particles, orbs, phantomDashes;

let arena;      // { num, timeRemainingMs, spawnTimer, enemyCountRemaining, kills, tookDamage }
let combo;      // { value, timerMs }
let shake;      // { x, y }
let input;      // { mx, my, charging, chargeStart, dashCharges, dashCdMs }
let runMeta;    // { startTime, score, kills, dashes, maxCombo, upgradesPicked }

let lastTime = 0;

// Floating damage/score numbers
let damageNumbers = [];
// Hit-freeze countdown (ms) — briefly pauses time on kills for impact
let hitFreezeMs = 0;

// ─────────────────────────────────────────────────────
// START / STOP
// ─────────────────────────────────────────────────────
function start(opts) {
  onExit = opts.onExit || (() => {});
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);

  bindInputs();

  initRun();
  running = true;
  paused = false;
  lastTime = performance.now();
  requestAnimationFrame(loop);
  if (NEON.audio) NEON.audio.arenaStart();
}

function stop(goToMenu) {
  running = false;
  unbindInputs();
  window.removeEventListener('resize', resize);
  const cb = onExit; onExit = null;
  if (cb) cb();
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width  = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ─────────────────────────────────────────────────────
// INIT RUN
// ─────────────────────────────────────────────────────
function initRun() {
  stats = {
    dashDistanceMult: 1.0,
    dashCooldownMult: 1.0,
    chargeSpeedMult:  1.0,
    dashRadiusMult:   1.0,
    comboDecayMult:   1.0,
    shockwaveLevel:   0,
    pierce:           false,
    maxCharges:       1,
    slowmo:           false,
    magnetMult:       1.0,
    overdrive:        false,
    echo:             false,
    iframeMult:       1.0,
    scavenger:        false,
  };
  ownedUpgrades = {};

  player = {
    x: W / 2, y: H / 2,
    vx: 0, vy: 0,
    radius: CFG.PLAYER_RADIUS,
    lives: CFG.PLAYER_LIVES,
    iframes: 0,
    dashing: false,
    dashTx: 0, dashTy: 0,
    dashKillsThisDash: 0,
    dashKillStreak: 0,    // for overdrive
  };

  enemies = [];
  projectiles = [];
  particles = [];
  orbs = [];
  phantomDashes = [];
  shockwaves.length = 0;
  damageNumbers = [];
  hitFreezeMs = 0;

  combo = { value: 0, timerMs: 0 };
  shake = { x: 0, y: 0 };

  input = {
    mx: W / 2, my: H / 2 - 100,
    charging: false,
    chargeStart: 0,
    dashCharges: 1,
    dashCdMs: 0,
  };

  runMeta = {
    startTime: performance.now(),
    score: 0,
    kills: 0,
    dashes: 0,
    maxCombo: 0,
    upgradesPicked: 0,
  };

  startArena(1);
}

function startArena(num) {
  const isBoss = num % 5 === 0;
  const count = isBoss ? 0 : CFG.ARENA_ENEMY_BASE + (num - 1) * CFG.ARENA_ENEMY_SCALE;
  arena = {
    num,
    isBoss,
    timeRemainingMs: CFG.ARENA_DURATION_SEC * 1000,
    spawnTimer: 0,
    enemyCountRemaining: count,
    kills: 0,
    tookDamage: false,
  };
  if (stats.scavenger && num > 1 && player.lives < 5) player.lives = Math.min(5, player.lives + 1);
  input.dashCharges = stats.maxCharges;
  if (isBoss) spawnBoss(num);
  showArenaAnnounce(num);
  updateHUD();
  updateModifierBar();
  if (NEON.audio) NEON.audio.arenaStart();
}

function spawnBoss(arenaNum) {
  const tier = Math.floor(arenaNum / 5);
  const b = {
    type: 'boss',
    x: W / 2, y: H / 2 - 120,
    vx: 0, vy: 0,
    radius: 34 + tier * 4,
    hp: 10 + tier * 6,
    hpMax: 10 + tier * 6,
    speed: 0.6 + tier * 0.1,
    color: '#ff2a6d',
    score: 2500 + tier * 1000,
    fireTimer: 1200,
    phase: 0,
    phaseTimer: 3000,
  };
  enemies.push(b);
}

// ─────────────────────────────────────────────────────
// INPUT
// ─────────────────────────────────────────────────────
function onMouseMove(e) { input.mx = e.clientX; input.my = e.clientY; }
function onMouseDown(e) {
  if (paused) return;
  if (e.button !== 0) return;
  if (input.dashCharges <= 0 || input.dashCdMs > 0) return;
  input.charging = true;
  input.chargeStart = performance.now();
  if (NEON.audio) NEON.audio.dashCharge();
}
function onMouseUp(e) {
  if (paused) return;
  if (e.button !== 0) return;
  if (!input.charging) return;
  const heldMs = performance.now() - input.chargeStart;
  input.charging = false;
  fireDash(heldMs);
}
function onKeyDown(e) {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    togglePause();
  } else if (e.code === 'Space') {
    if (paused) return;
    if (input.dashCharges <= 0 || input.dashCdMs > 0) return;
    if (!input.charging) {
      input.charging = true;
      input.chargeStart = performance.now();
      if (NEON.audio) NEON.audio.dashCharge();
    }
  }
}
function onKeyUp(e) {
  if (e.code === 'Space' && input.charging) {
    const heldMs = performance.now() - input.chargeStart;
    input.charging = false;
    fireDash(heldMs);
  }
}

function bindInputs() {
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup',   onMouseUp);
  window.addEventListener('keydown',   onKeyDown);
  window.addEventListener('keyup',     onKeyUp);
  document.getElementById('pause-resume').addEventListener('click', togglePause);
  document.getElementById('pause-menu').addEventListener('click', exitToMenu);
  document.getElementById('go-retry').addEventListener('click', retryRun);
  document.getElementById('go-share').addEventListener('click', shareScore);
  document.getElementById('go-menu').addEventListener('click', exitToMenu);
}
function unbindInputs() {
  canvas.removeEventListener('mousemove', onMouseMove);
  canvas.removeEventListener('mousedown', onMouseDown);
  window.removeEventListener('mouseup',   onMouseUp);
  window.removeEventListener('keydown',   onKeyDown);
  window.removeEventListener('keyup',     onKeyUp);
}

function fireDash(heldMs) {
  // How charged the dash was (0.0 → 1.0)
  const maxMs = CFG.DASH_CHARGE_MAX_MS * stats.chargeSpeedMult;
  const minMs = CFG.DASH_CHARGE_MIN_MS * stats.chargeSpeedMult;
  const t = Math.max(0, Math.min(1, (heldMs - minMs) / Math.max(1, (maxMs - minMs))));
  // Even a tap gives a minimum dash
  const effT = Math.max(0.25, t);
  const baseDist = CFG.DASH_DISTANCE_MIN + (CFG.DASH_DISTANCE_MAX - CFG.DASH_DISTANCE_MIN) * effT;
  const dist = baseDist * stats.dashDistanceMult;

  const dx = input.mx - player.x;
  const dy = input.my - player.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len, ny = dy / len;

  // target
  player.dashTx = player.x + nx * dist;
  player.dashTy = player.y + ny * dist;
  player.vx = nx * CFG.DASH_SPEED;
  player.vy = ny * CFG.DASH_SPEED;
  player.dashing = true;
  player.dashKillsThisDash = 0;

  input.dashCharges -= 1;
  input.dashCdMs = CFG.DASH_COOLDOWN_MS * stats.dashCooldownMult;
  runMeta.dashes += 1;

  // Phantom (echo) dash
  if (stats.echo) {
    phantomDashes.push({
      x: player.x, y: player.y,
      tx: player.dashTx, ty: player.dashTy,
      vx: nx * CFG.DASH_SPEED * 0.75,
      vy: ny * CFG.DASH_SPEED * 0.75,
      life: 1.0,
    });
  }

  if (NEON.audio) NEON.audio.dashFire();
}

// ─────────────────────────────────────────────────────
// PAUSE / EXIT
// ─────────────────────────────────────────────────────
function togglePause() {
  if (!running) return;
  paused = !paused;
  document.getElementById('pause-screen').classList.toggle('show', paused);
  if (!paused) {
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }
}
function exitToMenu() {
  document.getElementById('pause-screen').classList.remove('show');
  document.getElementById('gameover-screen').classList.remove('show');
  document.getElementById('upgrade-screen').classList.remove('show');
  stop(true);
}
function shareScore() {
  const text = `🎮 NEON PULSE — Score: ${runMeta.score.toLocaleString()} | Arena ${arena.num} | Max Combo x${runMeta.maxCombo} | ${runMeta.kills} kills\nCan you beat me? #NeonPulse`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      NEON.toast({ name: 'Score copied to clipboard!' });
    });
  }
}

function retryRun() {
  document.getElementById('gameover-screen').classList.remove('show');
  document.getElementById('go-new-best').classList.remove('show');
  initRun();
  running = true;
  paused = false;
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

// ─────────────────────────────────────────────────────
// SPAWNING
// ─────────────────────────────────────────────────────
function pickEnemyType(arenaNum) {
  const r = Math.random();
  if (arenaNum <= 1) return 'basic';
  if (arenaNum <= 2) return r < 0.70 ? 'basic' : 'fast';
  if (arenaNum <= 3) return r < 0.55 ? 'basic' : r < 0.80 ? 'fast' : 'tank';
  if (arenaNum <= 5) {
    if (r < 0.40) return 'basic';
    if (r < 0.65) return 'fast';
    if (r < 0.85) return 'tank';
    return 'shooter';
  }
  // arena 6+
  if (r < 0.30) return 'basic';
  if (r < 0.55) return 'fast';
  if (r < 0.70) return 'tank';
  if (r < 0.85) return 'shooter';
  return 'splitter';
}

function spawnEnemy(type) {
  const side = Math.floor(Math.random() * 4);
  const pad = CFG.ENEMY_SPAWN_MARGIN;
  let x, y;
  if (side === 0) { x = Math.random() * W; y = -pad; }
  else if (side === 1) { x = W + pad; y = Math.random() * H; }
  else if (side === 2) { x = Math.random() * W; y = H + pad; }
  else                 { x = -pad; y = Math.random() * H; }

  const e = { type, x, y, vx: 0, vy: 0 };
  switch (type) {
    case 'basic':
      e.speed = CFG.BASIC_SPEED; e.radius = CFG.BASIC_RADIUS; e.hp = CFG.BASIC_HP; e.color = CFG.COLORS.basic;
      e.score = CFG.SCORE_BASIC;
      break;
    case 'fast':
      e.speed = CFG.FAST_SPEED; e.radius = CFG.FAST_RADIUS; e.hp = CFG.FAST_HP; e.color = CFG.COLORS.fast;
      e.score = CFG.SCORE_FAST;
      break;
    case 'tank':
      e.speed = CFG.TANK_SPEED; e.radius = CFG.TANK_RADIUS; e.hp = CFG.TANK_HP; e.color = CFG.COLORS.tank;
      e.score = CFG.SCORE_TANK;
      break;
    case 'shooter':
      e.speed = CFG.SHOOTER_SPEED; e.radius = CFG.SHOOTER_RADIUS; e.hp = CFG.SHOOTER_HP;
      e.color = CFG.COLORS.shooter; e.score = CFG.SCORE_SHOOTER;
      e.fireTimer = 800 + Math.random() * 1200;
      break;
    case 'splitter':
      e.speed = CFG.SPLITTER_SPEED; e.radius = CFG.SPLITTER_RADIUS; e.hp = CFG.SPLITTER_HP;
      e.color = CFG.COLORS.splitter; e.score = CFG.SCORE_SPLITTER;
      break;
    case 'baby':
      e.speed = CFG.BASIC_SPEED * 1.5; e.radius = 7; e.hp = 1; e.color = CFG.COLORS.baby; e.score = CFG.SCORE_BABY;
      break;
  }
  enemies.push(e);
}

function spawnWaveBatch() {
  if (arena.enemyCountRemaining <= 0) return;
  if (enemies.length >= CFG.MAX_ON_SCREEN) return;
  const batchSize = Math.min(
    arena.enemyCountRemaining,
    CFG.MAX_ON_SCREEN - enemies.length,
    2 + Math.floor(arena.num / 2)
  );
  for (let i = 0; i < batchSize; i++) {
    spawnEnemy(pickEnemyType(arena.num));
    arena.enemyCountRemaining -= 1;
  }
}

// ─────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────
function loop(now) {
  if (!running) return;
  if (paused) return;
  const dt = Math.min(50, now - lastTime);
  lastTime = now;

  // Hit-freeze pauses time for impact — renders still proceed
  if (hitFreezeMs > 0) {
    hitFreezeMs -= dt;
    render();
    requestAnimationFrame(loop);
    return;
  }

  const slow = (stats.slowmo && input.charging) ? 0.35 : 1.0;
  const gdt = dt * slow;

  update(gdt, dt);
  render();

  requestAnimationFrame(loop);
}

function update(dt, rawDt) {
  // ─── Arena timing / spawning ───
  arena.timeRemainingMs -= rawDt;
  arena.spawnTimer -= rawDt;
  if (arena.spawnTimer <= 0) {
    arena.spawnTimer = 700 - Math.min(400, arena.num * 40);
    spawnWaveBatch();
  }

  // Dash cooldown / recharge
  if (input.dashCdMs > 0) {
    input.dashCdMs -= rawDt;
    if (input.dashCdMs <= 0 && input.dashCharges < stats.maxCharges) {
      input.dashCharges = Math.min(stats.maxCharges, input.dashCharges + 1);
    }
  }

  // Combo decay
  if (combo.value > 0) {
    combo.timerMs -= rawDt;
    if (combo.timerMs <= 0) setCombo(0);
  }

  // Shake decay
  shake.x *= CFG.SHAKE_DECAY;
  shake.y *= CFG.SHAKE_DECAY;

  // i-frames
  if (player.iframes > 0) player.iframes -= rawDt;

  // ─── Player movement ───
  if (player.dashing) {
    player.x += player.vx;
    player.y += player.vy;
    // overshoot check
    const remaining = Math.hypot(player.dashTx - player.x, player.dashTy - player.y);
    if (remaining < CFG.DASH_SPEED) {
      player.dashing = false;
      if (stats.shockwaveLevel > 0) spawnShockwave(player.x, player.y);
    }
  } else {
    // idle drift toward cursor
    const dx = input.mx - player.x;
    const dy = input.my - player.y;
    const d = Math.hypot(dx, dy);
    if (d > 2) {
      player.vx = (dx / d) * CFG.AUTO_MOVE_SPEED;
      player.vy = (dy / d) * CFG.AUTO_MOVE_SPEED;
    } else {
      player.vx *= CFG.FRICTION;
      player.vy *= CFG.FRICTION;
    }
    player.x += player.vx;
    player.y += player.vy;
  }

  // Clamp to canvas
  const cx = W / 2, cy = H / 2;
  const arenaR = Math.min(W, H) * CFG.ARENA_RADIUS_FACTOR;
  // soft clamp to arena circle
  const pdx = player.x - cx, pdy = player.y - cy;
  const pd = Math.hypot(pdx, pdy);
  if (pd > arenaR - player.radius) {
    const nx = pdx / pd, ny = pdy / pd;
    player.x = cx + nx * (arenaR - player.radius);
    player.y = cy + ny * (arenaR - player.radius);
    if (player.dashing) { player.dashing = false; if (stats.shockwaveLevel > 0) spawnShockwave(player.x, player.y); }
  }

  // ─── Phantoms ───
  for (let i = phantomDashes.length - 1; i >= 0; i--) {
    const p = phantomDashes[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.04;
    const rem = Math.hypot(p.tx - p.x, p.ty - p.y);
    if (rem < CFG.DASH_SPEED || p.life <= 0) phantomDashes.splice(i, 1);
    else {
      // damage enemies in path
      for (let ei = enemies.length - 1; ei >= 0; ei--) {
        const e = enemies[ei];
        if (dist(p, e) < 20 + e.radius) killEnemy(ei, { source: 'phantom' });
      }
    }
  }

  // ─── Enemies ───
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const dx = player.x - e.x, dy = player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d, ny = dy / d;

    if (e.type === 'shooter') {
      // stop at a distance and shoot
      if (d > CFG.SHOOTER_STOP_DIST) {
        e.x += nx * e.speed;
        e.y += ny * e.speed;
      }
      e.fireTimer -= rawDt;
      if (e.fireTimer <= 0) {
        e.fireTimer = CFG.SHOOTER_FIRE_MS;
        projectiles.push({
          x: e.x, y: e.y,
          vx: nx * CFG.SHOOTER_PROJ_SPEED,
          vy: ny * CFG.SHOOTER_PROJ_SPEED,
          radius: 4,
          life: 2400,
        });
      }
    } else if (e.type === 'boss') {
      // Slow orbit around arena center, rotate phases
      const cxB = W / 2, cyB = H / 2;
      const dxB = e.x - cxB, dyB = e.y - cyB;
      const angB = Math.atan2(dyB, dxB) + 0.006 * e.speed;
      const rad  = 180;
      e.x = cxB + Math.cos(angB) * rad;
      e.y = cyB + Math.sin(angB) * rad;
      e.phaseTimer -= rawDt;
      if (e.phaseTimer <= 0) { e.phase = (e.phase + 1) % 3; e.phaseTimer = 3200; }
      e.fireTimer -= rawDt;
      if (e.fireTimer <= 0) {
        if (e.phase === 0) {
          // radial burst
          const n = 12;
          for (let k = 0; k < n; k++) {
            const a = (Math.PI * 2 / n) * k;
            projectiles.push({
              x: e.x, y: e.y,
              vx: Math.cos(a) * 3.2, vy: Math.sin(a) * 3.2,
              radius: 4, life: 3000,
            });
          }
          e.fireTimer = 1600;
        } else if (e.phase === 1) {
          // aimed triple
          for (let k = -1; k <= 1; k++) {
            const a = Math.atan2(player.y - e.y, player.x - e.x) + k * 0.2;
            projectiles.push({
              x: e.x, y: e.y,
              vx: Math.cos(a) * 4.8, vy: Math.sin(a) * 4.8,
              radius: 4, life: 2400,
            });
          }
          e.fireTimer = 550;
        } else {
          // spiral
          const a = (performance.now() * 0.004) % (Math.PI * 2);
          for (let k = 0; k < 3; k++) {
            const aa = a + k * (Math.PI * 2 / 3);
            projectiles.push({
              x: e.x, y: e.y,
              vx: Math.cos(aa) * 3.6, vy: Math.sin(aa) * 3.6,
              radius: 4, life: 2600,
            });
          }
          e.fireTimer = 140;
        }
      }
    } else {
      e.x += nx * e.speed;
      e.y += ny * e.speed;
    }

    // Dash collision
    if (player.dashing) {
      const hitR = 18 * stats.dashRadiusMult + e.radius;
      if (d < hitR) {
        killEnemy(i, { source: 'dash' });
        continue;
      }
    }

    // Enemy body collision with player
    if (player.iframes <= 0 && !player.dashing && d < player.radius + e.radius - 2) {
      hitPlayer();
      // the enemy still lives, but shove it back a bit
      e.x += nx * -8; e.y += ny * -8;
    }
  }

  // ─── Projectiles ───
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.vx; p.y += p.vy;
    p.life -= rawDt;
    if (p.life <= 0 || p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) {
      projectiles.splice(i, 1);
      continue;
    }
    // hit player
    if (player.iframes <= 0 && !player.dashing && dist(p, player) < p.radius + player.radius) {
      projectiles.splice(i, 1);
      hitPlayer();
      continue;
    }
    // dash destroys projectiles
    if (player.dashing && dist(p, player) < 18 * stats.dashRadiusMult + p.radius) {
      projectiles.splice(i, 1);
      spawnSpark(p.x, p.y, CFG.COLORS.projectile, 6);
    }
  }

  // ─── Orbs (XP/score) ───
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i];
    // magnet pull
    const dx = player.x - o.x, dy = player.y - o.y;
    const d = Math.hypot(dx, dy) || 1;
    const magnetR = 80 * stats.magnetMult;
    if (d < magnetR) {
      const s = 0.12 + (1 - d / magnetR) * 0.4;
      o.vx += (dx / d) * s;
      o.vy += (dy / d) * s;
    }
    o.vx *= 0.94; o.vy *= 0.94;
    o.x += o.vx; o.y += o.vy;
    o.life -= rawDt;
    if (d < player.radius + 6) {
      addScore(o.value);
      spawnSpark(o.x, o.y, CFG.COLORS.xp, 4);
      orbs.splice(i, 1);
    } else if (o.life <= 0) {
      orbs.splice(i, 1);
    }
  }

  // ─── Damage numbers ───
  for (let i = damageNumbers.length - 1; i >= 0; i--) {
    const d = damageNumbers[i];
    d.y += d.vy;
    d.vy *= 0.96;
    d.life -= 0.018;
    if (d.life <= 0) damageNumbers.splice(i, 1);
  }

  // ─── Particles ───
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.95; p.vy *= 0.95;
    p.life -= p.decay * (rawDt / 16.6);
    if (p.life <= 0) particles.splice(i, 1);
  }

  // ─── Shockwaves ───
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const s = shockwaves[i];
    s.r += s.speed;
    s.life -= rawDt;
    // damage enemies entering the ring
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];
      const d = dist(s, e);
      if (!s.hit) s.hit = new Set();
      if (d < s.r + e.radius && d > s.r - 20 - e.radius && !s.hit.has(e)) {
        s.hit.add(e);
        killEnemy(ei, { source: 'shockwave' });
      }
    }
    if (s.life <= 0 || s.r > Math.max(W, H)) shockwaves.splice(i, 1);
  }

  // ─── Arena clear? ───
  if (arena.isBoss) {
    if (enemies.length === 0) clearArena();
  } else if (arena.timeRemainingMs <= 0 && enemies.length === 0 && arena.enemyCountRemaining <= 0) {
    clearArena();
  }

  updateHUD();
}

// Shockwaves live at module scope so they persist
const shockwaves = [];
function spawnShockwave(x, y) {
  shockwaves.push({
    x, y,
    r: 0,
    speed: 9 + stats.shockwaveLevel * 2,
    life: 600,
  });
}

// ─────────────────────────────────────────────────────
// KILLS / SCORING / DAMAGE
// ─────────────────────────────────────────────────────
function killEnemy(idx, ctxObj) {
  const e = enemies[idx];
  // Bosses take variable damage per source; dash = 1, shockwave/phantom = 1.
  const dmg = 1;
  e.hp -= dmg;
  if (e.type === 'boss' && e.hp > 0) {
    spawnSpark(e.x, e.y, '#ff2a6d', 10);
    spawnDamageNumber(e.x, e.y, '-1', '#ff2a6d');
    triggerShake(2);
    if (NEON.audio) NEON.audio.enemyHit();
    return;
  }
  if (e.hp > 0 && !stats.pierce && ctxObj.source === 'dash') {
    // bounce-back on tank still-alive
    spawnSpark(e.x, e.y, e.color, 6);
    if (NEON.audio) NEON.audio.enemyHit();
    return;
  }
  if (e.hp > 0 && !stats.pierce && ctxObj.source !== 'dash') {
    // shockwave/phantom: one-shot everything for now
  }

  enemies.splice(idx, 1);
  spawnExplosion(e.x, e.y, e.color, CFG.PARTICLE_COUNT_DIE);
  triggerShake(4);
  if (NEON.audio) NEON.audio.enemyDie();

  if (e.type === 'splitter') {
    // Spawn two babies
    for (let k = 0; k < 2; k++) {
      const ang = Math.random() * Math.PI * 2;
      const nx = Math.cos(ang), ny = Math.sin(ang);
      const baby = {
        type: 'baby',
        x: e.x + nx * 10, y: e.y + ny * 10,
        vx: 0, vy: 0,
        speed: CFG.BASIC_SPEED * 1.5, radius: 7, hp: 1, color: CFG.COLORS.baby,
        score: CFG.SCORE_BABY,
      };
      enemies.push(baby);
    }
  }

  // Drop score orb sometimes
  if (Math.random() < 0.35) {
    orbs.push({
      x: e.x, y: e.y,
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 3,
      value: Math.floor(e.score * 0.3),
      life: 6000,
    });
  }

  // Score & combo
  const comboMult = 1 + combo.value * 0.1;
  const gained = Math.floor(e.score * comboMult);
  addScore(gained);
  spawnDamageNumber(e.x, e.y, '+' + gained, comboMult >= 1.5 ? '#ff2a6d' : '#05d9e8');

  // Hit-freeze pulse — scales with combo for that satisfying heavy-hit feel
  if (combo.value >= 3 || e.type === 'tank' || e.type === 'boss') {
    hitFreezeMs = Math.max(hitFreezeMs, e.type === 'boss' ? 90 : 40);
  }

  bumpCombo();
  runMeta.kills += 1;
  arena.kills  += 1;

  if (ctxObj.source === 'dash') {
    player.dashKillsThisDash += 1;
    player.dashKillStreak   += 1;
    NEON.achievements.checkOnKill({
      killsThisDash: player.dashKillsThisDash,
      totalKillsAllTime: NEON.storage.stats.totalKills + runMeta.kills,
    });
    if (stats.overdrive && player.dashKillStreak >= 5) {
      player.dashKillStreak = 0;
      input.dashCharges = Math.min(stats.maxCharges, input.dashCharges + 1);
      spawnSpark(player.x, player.y, '#ffff66', 12);
    }
  }
  NEON.achievements.checkOnScore(runMeta.score);
}

function bumpCombo() {
  combo.value += 1;
  combo.timerMs = CFG.COMBO_DECAY_MS * stats.comboDecayMult;
  if (combo.value > runMeta.maxCombo) runMeta.maxCombo = combo.value;
  NEON.achievements.checkOnCombo(combo.value);
  if (NEON.audio) NEON.audio.combo(Math.min(10, combo.value));
  const cv = document.getElementById('combo-val');
  cv.classList.remove('flash');
  void cv.offsetWidth;
  cv.classList.add('flash');
}

function setCombo(v) {
  combo.value = v;
  combo.timerMs = 0;
}

function addScore(n) {
  runMeta.score += n;
}

function hitPlayer() {
  if (player.iframes > 0 || player.dashing) return;
  player.lives -= 1;
  player.iframes = CFG.IFRAMES_MS * stats.iframeMult;
  setCombo(0);
  arena.tookDamage = true;
  spawnExplosion(player.x, player.y, '#ff2a6d', 18);
  triggerShake(14);
  damageVignette();
  if (NEON.audio) NEON.audio.playerHit();
  if (player.lives <= 0) gameOver();
  else updateHUD();
}

// ─────────────────────────────────────────────────────
// ARENA CLEAR / UPGRADES
// ─────────────────────────────────────────────────────
function clearArena() {
  addScore(CFG.ARENA_CLEAR_BONUS + arena.num * 50);
  NEON.achievements.checkOnArenaClear({ arenaNum: arena.num, perfectArena: !arena.tookDamage });
  // Award a dash recharge
  input.dashCharges = stats.maxCharges;
  showUpgradeChoices();
}

function showUpgradeChoices() {
  paused = true;
  const choices = rollUpgrades(3, ownedUpgrades);
  const cardsEl = document.getElementById('upgrade-cards');
  cardsEl.innerHTML = '';
  if (choices.length === 0) {
    // everything maxed — give a stash bonus
    addScore(1500);
    startArena(arena.num + 1);
    paused = false;
    lastTime = performance.now();
    requestAnimationFrame(loop);
    return;
  }
  for (const u of choices) {
    const card = document.createElement('div');
    card.className = 'upgrade-card ' + u.rarity;
    card.innerHTML = `
      <div class="up-rarity">${u.rarity}</div>
      <div class="up-name">${u.name}</div>
      <div class="up-desc">${u.desc}</div>
      <div class="up-hint">CLICK TO TAKE</div>
    `;
    card.addEventListener('click', () => pickUpgrade(u));
    cardsEl.appendChild(card);
  }
  document.getElementById('upgrade-screen').classList.add('show');
}

function pickUpgrade(u) {
  u.apply(stats);
  ownedUpgrades[u.id] = (ownedUpgrades[u.id] || 0) + 1;
  runMeta.upgradesPicked += 1;
  NEON.achievements.checkOnUpgradePick(u.rarity);
  if (NEON.audio) NEON.audio.upgrade();
  document.getElementById('upgrade-screen').classList.remove('show');
  startArena(arena.num + 1);
  paused = false;
  lastTime = performance.now();
  requestAnimationFrame(loop);
  updateModifierBar();
}

// ─────────────────────────────────────────────────────
// GAME OVER
// ─────────────────────────────────────────────────────
function gameOver() {
  running = false;
  const playtimeSec = Math.round((performance.now() - runMeta.startTime) / 1000);
  if (NEON.audio) NEON.audio.gameOver();

  const newBest = NEON.storage.recordRun({
    score: runMeta.score,
    kills: runMeta.kills,
    dashes: runMeta.dashes,
    combo: runMeta.maxCombo,
    arena: arena.num,
    playtimeSec,
  });

  NEON.achievements.checkOnRunEnd({
    score: runMeta.score,
    dashes: runMeta.dashes,
    playtimeSec,
    upgradesPicked: runMeta.upgradesPicked,
  });
  NEON.achievements.checkOnDashTotal(NEON.storage.stats.totalDashes);

  document.getElementById('go-score').textContent = runMeta.score.toLocaleString();
  document.getElementById('go-arena').textContent = arena.num;
  document.getElementById('go-combo').textContent = 'x' + runMeta.maxCombo;
  document.getElementById('go-kills').textContent = runMeta.kills;
  document.getElementById('go-new-best').classList.toggle('show', newBest);
  document.getElementById('gameover-screen').classList.add('show');
}

// ─────────────────────────────────────────────────────
// PARTICLES / SPARKS
// ─────────────────────────────────────────────────────
const MAX_PARTICLES = 500;
function spawnExplosion(x, y, color, count) {
  if (!NEON.storage.settings.particles) count = Math.floor(count / 3);
  count = Math.min(count, MAX_PARTICLES - particles.length);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 1 + Math.random() * 5;
    particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 1, decay: 0.02 + Math.random() * 0.03,
      radius: 1.5 + Math.random() * 2.5,
      color,
    });
  }
}
function spawnSpark(x, y, color, count = 6) {
  spawnExplosion(x, y, color, count);
}
function triggerShake(n) {
  if (!NEON.storage.settings.screenShake) return;
  shake.x = (Math.random() - 0.5) * n;
  shake.y = (Math.random() - 0.5) * n;
}

function spawnDamageNumber(x, y, text, color) {
  damageNumbers.push({
    x: x + (Math.random() - 0.5) * 12,
    y: y - 4,
    vy: -1.6 - Math.random() * 0.4,
    text, color,
    life: 1.0,
    scale: 1 + Math.min(1.2, (text.length - 2) * 0.05),
  });
  if (damageNumbers.length > 60) damageNumbers.splice(0, damageNumbers.length - 60);
}
function damageVignette() {
  const el = document.getElementById('damage-vignette');
  el.classList.add('hit');
  setTimeout(() => el.classList.remove('hit'), 200);
}

// ─────────────────────────────────────────────────────
// RENDERING
// ─────────────────────────────────────────────────────
function render() {
  const chroma = NEON.storage.settings.chromaticAberration;

  ctx.save();
  ctx.translate(shake.x, shake.y);

  // clear
  ctx.fillStyle = '#02010a';
  ctx.fillRect(0, 0, W, H);

  // arena ring
  const cx = W/2, cy = H/2;
  const arenaR = Math.min(W, H) * CFG.ARENA_RADIUS_FACTOR;
  drawArena(cx, cy, arenaR);

  // orbs
  for (const o of orbs) {
    ctx.save();
    ctx.shadowBlur = 12; ctx.shadowColor = CFG.COLORS.xp;
    ctx.fillStyle = CFG.COLORS.xp;
    ctx.beginPath(); ctx.arc(o.x, o.y, 3, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // projectiles
  for (const p of projectiles) {
    ctx.save();
    ctx.shadowBlur = 14; ctx.shadowColor = CFG.COLORS.projectile;
    ctx.fillStyle = CFG.COLORS.projectile;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // shockwaves
  for (const s of shockwaves) {
    ctx.save();
    ctx.strokeStyle = '#ffff66';
    ctx.globalAlpha = Math.max(0, s.life / 600);
    ctx.lineWidth = 3;
    ctx.shadowBlur = 20; ctx.shadowColor = '#ffff66';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
  }

  // phantom dashes
  for (const p of phantomDashes) {
    ctx.save();
    ctx.globalAlpha = p.life * 0.5;
    ctx.strokeStyle = '#05d9e8';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 10; ctx.shadowColor = '#05d9e8';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }

  // enemies
  for (const e of enemies) drawEnemy(e);

  // particles (behind player for backdrop, but we want them behind trails too)
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.shadowBlur = 8; ctx.shadowColor = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // damage numbers (above everything but UI)
  for (const d of damageNumbers) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, d.life);
    ctx.fillStyle = d.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 10;
    ctx.shadowColor = d.color;
    ctx.font = `900 ${Math.floor(16 * d.scale)}px Orbitron, Segoe UI, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(d.text, d.x, d.y);
    ctx.fillText(d.text, d.x, d.y);
    ctx.restore();
  }

  // player + trail
  drawPlayer(chroma);

  // charge ring at cursor
  if (input.charging) {
    const held = performance.now() - input.chargeStart;
    const maxMs = CFG.DASH_CHARGE_MAX_MS * stats.chargeSpeedMult;
    const minMs = CFG.DASH_CHARGE_MIN_MS * stats.chargeSpeedMult;
    const t = Math.max(0, Math.min(1, (held - minMs) / Math.max(1, maxMs - minMs)));
    drawChargeRing(input.mx, input.my, t);
    drawAimLine(player.x, player.y, input.mx, input.my, t);
  } else {
    // cursor reticle
    drawReticle(input.mx, input.my);
  }

  // dash cooldown indicator on player
  if (input.dashCdMs > 0) drawDashCooldown();

  // Boss HP bar
  const boss = enemies.find(e => e.type === 'boss');
  if (boss) drawBossHP(boss);

  ctx.restore();
}

function drawBossHP(b) {
  const barW = Math.min(640, W * 0.5);
  const barH = 10;
  const x = (W - barW) / 2;
  const y = 110;
  ctx.save();
  // label
  ctx.fillStyle = '#ff2a6d';
  ctx.font = '900 11px Orbitron, Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.shadowBlur = 10; ctx.shadowColor = '#ff2a6d';
  ctx.fillText('APEX SIGNAL', W / 2, y - 8);
  ctx.shadowBlur = 0;
  // track
  ctx.fillStyle = 'rgba(255,42,109,0.15)';
  ctx.fillRect(x, y, barW, barH);
  // fill
  const pct = Math.max(0, b.hp / b.hpMax);
  const grad = ctx.createLinearGradient(x, y, x + barW, y);
  grad.addColorStop(0, '#ff2a6d');
  grad.addColorStop(1, '#ffffff');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, barW * pct, barH);
  // frame
  ctx.strokeStyle = '#ff2a6d';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 0.5, y - 0.5, barW + 1, barH + 1);
  ctx.restore();
}

function drawArena(cx, cy, r) {
  // outer ring
  ctx.save();
  ctx.strokeStyle = 'rgba(5, 217, 232, 0.5)';
  ctx.lineWidth = 2;
  ctx.shadowBlur = 16;
  ctx.shadowColor = '#05d9e8';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();

  // inner soft fill
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, 'rgba(5, 217, 232, 0.025)');
  grad.addColorStop(1, 'rgba(5, 217, 232, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();

  // timer arc
  const progress = Math.max(0, arena.timeRemainingMs / (CFG.ARENA_DURATION_SEC * 1000));
  ctx.strokeStyle = 'rgba(255, 42, 109, 0.7)';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#ff2a6d';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 6, -Math.PI/2, -Math.PI/2 + Math.PI*2 * progress);
  ctx.stroke();
  ctx.restore();
}

function drawEnemy(e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.shadowBlur = 14;
  ctx.shadowColor = e.color;
  ctx.strokeStyle = e.color;
  ctx.fillStyle   = e.color + '22';
  ctx.lineWidth = 2;

  if (e.type === 'basic' || e.type === 'baby') {
    // diamond
    ctx.beginPath();
    ctx.moveTo(0, -e.radius); ctx.lineTo(e.radius, 0);
    ctx.lineTo(0, e.radius);  ctx.lineTo(-e.radius, 0);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (e.type === 'fast') {
    // arrow/triangle
    const a = Math.atan2(player.y - e.y, player.x - e.x);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(e.radius, 0);
    ctx.lineTo(-e.radius, -e.radius * 0.7);
    ctx.lineTo(-e.radius * 0.4, 0);
    ctx.lineTo(-e.radius, e.radius * 0.7);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (e.type === 'tank') {
    // hex
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI/3) * i - Math.PI/6;
      const x = Math.cos(a) * e.radius, y = Math.sin(a) * e.radius;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // HP pips
    ctx.fillStyle = e.color;
    for (let i = 0; i < e.hp; i++) {
      ctx.beginPath(); ctx.arc(-6 + i * 6, 0, 2, 0, Math.PI*2); ctx.fill();
    }
  } else if (e.type === 'shooter') {
    // pulsing circle with cross
    const pulse = Math.sin(performance.now() * 0.004) * 2;
    ctx.beginPath(); ctx.arc(0, 0, e.radius + pulse, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle = e.color + '88';
    ctx.beginPath();
    ctx.moveTo(-e.radius - 4, 0); ctx.lineTo(e.radius + 4, 0);
    ctx.moveTo(0, -e.radius - 4); ctx.lineTo(0, e.radius + 4);
    ctx.stroke();
  } else if (e.type === 'splitter') {
    // square + inner split
    ctx.beginPath();
    ctx.rect(-e.radius, -e.radius, e.radius*2, e.radius*2);
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = e.color + '88';
    ctx.beginPath();
    ctx.moveTo(-e.radius, 0); ctx.lineTo(e.radius, 0);
    ctx.moveTo(0, -e.radius); ctx.lineTo(0, e.radius);
    ctx.stroke();
  } else if (e.type === 'boss') {
    // Rotating armoured core
    const t = performance.now() * 0.002;
    ctx.rotate(t);
    // outer rings
    ctx.lineWidth = 3;
    ctx.strokeStyle = e.color;
    ctx.shadowBlur = 25;
    ctx.shadowColor = e.color;
    ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI*2); ctx.stroke();
    // inner pulses
    ctx.strokeStyle = 'rgba(255,42,109,0.5)';
    ctx.beginPath(); ctx.arc(0, 0, e.radius * 0.7, 0, Math.PI*2); ctx.stroke();
    // blades
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI * 2 / 6) * k;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * e.radius * 0.8, Math.sin(a) * e.radius * 0.8);
      ctx.lineTo(Math.cos(a) * (e.radius + 10), Math.sin(a) * (e.radius + 10));
      ctx.stroke();
    }
    // core
    ctx.rotate(-t * 2);
    ctx.fillStyle = '#ff2a6d';
    ctx.beginPath(); ctx.arc(0, 0, e.radius * 0.35, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function drawPlayer(chroma) {
  const blink = player.iframes > 0 && Math.floor(player.iframes / 80) % 2 === 0;
  if (blink) return;

  const r = player.radius;

  // Dash trail
  if (player.dashing) {
    ctx.save();
    ctx.globalAlpha = 0.4;
    const tl = 8;
    for (let i = 0; i < tl; i++) {
      const a = 1 - i / tl;
      ctx.fillStyle = CFG.COLORS.dashTrail;
      ctx.shadowBlur = 20;
      ctx.shadowColor = CFG.COLORS.dashTrail;
      ctx.globalAlpha = a * 0.5;
      ctx.beginPath();
      ctx.arc(player.x - player.vx * i * 0.5, player.y - player.vy * i * 0.5, r - i * 0.5, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Chromatic aberration
  if (chroma && player.dashing) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#ff2a6d';
    ctx.beginPath(); ctx.arc(player.x - 2, player.y, r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#05d9e8';
    ctx.beginPath(); ctx.arc(player.x + 2, player.y, r, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // Core
  ctx.save();
  ctx.shadowBlur = 20;
  ctx.shadowColor = CFG.COLORS.playerGlow;
  ctx.fillStyle = CFG.COLORS.player;
  ctx.beginPath();
  ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
  ctx.fill();

  // Inner accent
  ctx.fillStyle = CFG.COLORS.playerGlow;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(player.x, player.y, r * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawChargeRing(x, y, t) {
  ctx.save();
  ctx.globalAlpha = 0.5 + 0.5 * t;
  ctx.strokeStyle = '#ff2a6d';
  ctx.lineWidth = 2;
  ctx.shadowBlur = 20; ctx.shadowColor = '#ff2a6d';
  const r = 14 + t * 20;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.stroke();
  // inner filled ring progress
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI/2, -Math.PI/2 + Math.PI*2 * t);
  ctx.stroke();
  ctx.restore();
}

function drawAimLine(x1, y1, x2, y2, t) {
  ctx.save();
  ctx.globalAlpha = 0.2 + 0.5 * t;
  ctx.strokeStyle = '#ff2a6d';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 6]);
  ctx.shadowBlur = 8; ctx.shadowColor = '#ff2a6d';
  ctx.beginPath();
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function drawReticle(x, y) {
  ctx.save();
  const baseAlpha = input.dashCharges > 0 && input.dashCdMs <= 0 ? 0.8 : 0.25;
  ctx.globalAlpha = baseAlpha;
  ctx.strokeStyle = '#05d9e8';
  ctx.lineWidth = 1;
  ctx.shadowBlur = 6; ctx.shadowColor = '#05d9e8';
  ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI*2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 18, y); ctx.lineTo(x - 14, y);
  ctx.moveTo(x + 14, y); ctx.lineTo(x + 18, y);
  ctx.moveTo(x, y - 18); ctx.lineTo(x, y - 14);
  ctx.moveTo(x, y + 14); ctx.lineTo(x, y + 18);
  ctx.stroke();
  ctx.restore();
}

function drawDashCooldown() {
  const total = CFG.DASH_COOLDOWN_MS * stats.dashCooldownMult;
  const pct = 1 - Math.min(1, input.dashCdMs / total);
  ctx.save();
  ctx.strokeStyle = '#ff2a6d';
  ctx.lineWidth = 2;
  ctx.shadowBlur = 8; ctx.shadowColor = '#ff2a6d';
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius + 5, -Math.PI/2, -Math.PI/2 + Math.PI * 2 * pct);
  ctx.stroke();
  ctx.restore();
}

// ─────────────────────────────────────────────────────
// HUD
// ─────────────────────────────────────────────────────
function updateHUD() {
  document.getElementById('hud-score').textContent = runMeta.score.toLocaleString();
  document.getElementById('hud-arena').textContent = arena.num;
  document.getElementById('hud-kills').textContent = runMeta.kills;
  // lives
  let l = '';
  for (let i = 0; i < 5; i++) l += i < player.lives ? '◆' : ' ';
  document.getElementById('hud-lives').textContent = l.trim();
  // time
  const secs = Math.floor((performance.now() - runMeta.startTime) / 1000);
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  document.getElementById('hud-time').textContent = `${m}:${s}`;
  // combo
  const box = document.getElementById('combo-box');
  if (combo.value >= 2) {
    box.classList.remove('hidden');
    document.getElementById('combo-val').textContent = 'x' + combo.value;
  } else {
    box.classList.add('hidden');
  }
}

function updateModifierBar() {
  const bar = document.getElementById('modifier-bar');
  bar.innerHTML = '';
  const items = [];
  for (const id of Object.keys(ownedUpgrades)) {
    const count = ownedUpgrades[id];
    const def = UPGRADES.find(u => u.id === id);
    if (!def) continue;
    items.push({ def, count });
  }
  for (const { def, count } of items) {
    const chip = document.createElement('div');
    chip.className = 'mod-chip' + (def.rarity === 'legendary' ? ' accent' : def.rarity === 'rare' ? ' violet' : '');
    chip.textContent = def.name + (count > 1 ? ` x${count}` : '');
    bar.appendChild(chip);
  }
}

function showArenaAnnounce(num) {
  const el = document.getElementById('announce');
  document.getElementById('announce-name').textContent = String(num).padStart(2, '0');
  const enemyHint = CFG.ARENA_ENEMY_BASE + (num - 1) * CFG.ARENA_ENEMY_SCALE;
  const names = ['NEON VOID','CRYO BLOCK','SHADOW NET','OVERDRIVE','PROTOCOL X','ECHO CHAMBER','RED STAR','BLACK NOISE','GHOST WIRE','ZERO HOUR'];
  const isBoss = num % 5 === 0;
  if (isBoss) {
    document.getElementById('announce-sub').textContent = 'APEX SIGNAL · BOSS ENCOUNTER';
  } else {
    document.getElementById('announce-sub').textContent = (names[(num-1) % names.length] || 'UNKNOWN') + ' · ' + enemyHint + ' HOSTILES';
  }
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1400);
}

// ─────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

// ─────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────
window.NeonPulseGame = { start };

})();

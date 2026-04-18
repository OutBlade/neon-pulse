// NEON PULSE — Launcher/menu controller

(() => {
  const storage = new Storage();
  const audio   = new AudioEngine();
  audio.setVolume(storage.settings.masterVolume);
  audio.setEnabled(storage.settings.sfx);

  const achievements = new AchievementManager(storage, (def) => toast(def, 'achievement'));

  // Expose globally for the game module
  window.NEON = { storage, audio, achievements, toast };

  // ─── Background starfield/grid ────────────
  const bgCanvas = document.getElementById('bg-canvas');
  const bgCtx = bgCanvas.getContext('2d');
  function resizeBG() {
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
  }
  resizeBG();
  window.addEventListener('resize', resizeBG);

  const PARTICLES = [];
  for (let i = 0; i < 80; i++) {
    PARTICLES.push({
      x: Math.random() * bgCanvas.width,
      y: Math.random() * bgCanvas.height,
      z: Math.random() * 0.8 + 0.2,
      vy: Math.random() * 0.3 + 0.05,
      vx: (Math.random() - 0.5) * 0.1,
      color: Math.random() < 0.5 ? '#05d9e8' : '#ff2a6d',
      alpha: Math.random() * 0.4 + 0.1,
    });
  }
  let bgTime = 0;
  function drawBG() {
    bgTime += 0.016;
    const w = bgCanvas.width, h = bgCanvas.height;
    bgCtx.fillStyle = 'rgba(5, 2, 10, 0.35)';
    bgCtx.fillRect(0, 0, w, h);

    // Grid
    bgCtx.strokeStyle = 'rgba(5, 217, 232, 0.05)';
    bgCtx.lineWidth = 1;
    const spacing = 80;
    const offset = (bgTime * 10) % spacing;
    for (let x = -offset; x < w; x += spacing) {
      bgCtx.beginPath();
      bgCtx.moveTo(x, 0); bgCtx.lineTo(x, h);
      bgCtx.stroke();
    }
    for (let y = -offset; y < h; y += spacing) {
      bgCtx.beginPath();
      bgCtx.moveTo(0, y); bgCtx.lineTo(w, y);
      bgCtx.stroke();
    }

    // Horizon line with distortion
    bgCtx.strokeStyle = 'rgba(255, 42, 109, 0.15)';
    bgCtx.lineWidth = 1.5;
    bgCtx.beginPath();
    for (let x = 0; x < w; x += 4) {
      const y = h * 0.55 + Math.sin(bgTime * 0.7 + x * 0.015) * 8;
      if (x === 0) bgCtx.moveTo(x, y); else bgCtx.lineTo(x, y);
    }
    bgCtx.stroke();

    // Floating particles
    for (const p of PARTICLES) {
      p.x += p.vx;
      p.y -= p.vy;
      if (p.y < -4) { p.y = h + 4; p.x = Math.random() * w; }
      bgCtx.globalAlpha = p.alpha * p.z;
      bgCtx.fillStyle = p.color;
      bgCtx.beginPath();
      bgCtx.arc(p.x, p.y, p.z * 1.6, 0, Math.PI * 2);
      bgCtx.fill();
    }
    bgCtx.globalAlpha = 1;

    // Neon sun/ring
    const cx = w * 0.5, cy = h * 0.35;
    const r  = Math.min(w, h) * 0.18;
    const grad = bgCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(255, 42, 109, 0.25)');
    grad.addColorStop(0.6, 'rgba(255, 42, 109, 0.06)');
    grad.addColorStop(1, 'rgba(255, 42, 109, 0)');
    bgCtx.fillStyle = grad;
    bgCtx.fillRect(cx - r, cy - r, r * 2, r * 2);

    requestAnimationFrame(drawBG);
  }
  drawBG();

  // ─── Screen switching ─────────────────────
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    audio.menuMove();
  }
  window.showScreen = showScreen;

  // ─── Main menu wiring ─────────────────────
  document.getElementById('btn-play').addEventListener('click', () => {
    audio.menuSelect();
    audio.stopAmbient();
    startGame();
  });
  document.getElementById('btn-settings').addEventListener('click', () => {
    audio.menuSelect();
    refreshSettings();
    showScreen('screen-settings');
  });
  document.getElementById('btn-stats').addEventListener('click', () => {
    audio.menuSelect();
    refreshStats();
    showScreen('screen-stats');
  });
  document.getElementById('btn-achievements').addEventListener('click', () => {
    audio.menuSelect();
    refreshAchievements();
    showScreen('screen-achievements');
  });
  document.getElementById('btn-credits').addEventListener('click', () => {
    audio.menuSelect();
    showScreen('screen-credits');
  });
  document.getElementById('btn-quit').addEventListener('click', () => {
    audio.menuSelect();
    if (window.neon && window.neon.isElectron) {
      window.neon.quit();
    } else {
      window.close();
    }
  });

  // Back buttons
  document.querySelectorAll('[data-back]').forEach(b => {
    b.addEventListener('click', () => {
      audio.menuMove();
      showScreen('screen-menu');
    });
  });

  // Menu button hover sound
  document.querySelectorAll('.menu-btn').forEach(b => {
    b.addEventListener('mouseenter', () => audio.menuMove());
  });

  // ─── Settings refresh/wire ────────────────
  function refreshSettings() {
    const s = storage.settings;
    const volSlider = document.getElementById('set-volume');
    const volVal    = document.getElementById('set-volume-val');
    volSlider.value = Math.round(s.masterVolume * 100);
    volVal.textContent = volSlider.value;

    toggleState('tog-sfx',     s.sfx);
    toggleState('tog-shake',   s.screenShake);
    toggleState('tog-chroma',  s.chromaticAberration);
    toggleState('tog-parts',   s.particles);
    toggleState('tog-crt',     s.crtFilter);
    applyCRT(s.crtFilter);
    const fpsSel = document.getElementById('set-fpscap');
    if (fpsSel) fpsSel.value = String(s.fpsCap || 0);
  }
  function toggleState(id, on) {
    const el = document.getElementById(id);
    if (on) el.classList.add('on'); else el.classList.remove('on');
  }

  document.getElementById('set-volume').addEventListener('input', (e) => {
    const v = parseInt(e.target.value) / 100;
    storage.setSetting('masterVolume', v);
    audio.setVolume(v);
    document.getElementById('set-volume-val').textContent = e.target.value;
  });
  document.getElementById('set-volume').addEventListener('change', () => audio.menuSelect());

  function wireToggle(id, key, sideEffect) {
    document.getElementById(id).addEventListener('click', () => {
      const next = !storage.settings[key];
      storage.setSetting(key, next);
      toggleState(id, next);
      if (key === 'sfx') audio.setEnabled(next);
      audio.menuSelect();
      if (sideEffect) sideEffect(next);
    });
  }
  wireToggle('tog-sfx',     'sfx');
  wireToggle('tog-shake',   'screenShake');
  wireToggle('tog-chroma',  'chromaticAberration');
  wireToggle('tog-parts',   'particles');
  wireToggle('tog-crt',     'crtFilter', applyCRT);

  const fpsSel = document.getElementById('set-fpscap');
  if (fpsSel) {
    fpsSel.addEventListener('change', (e) => {
      storage.setSetting('fpsCap', parseInt(e.target.value, 10) || 0);
      audio.menuSelect();
    });
  }

  function applyCRT(on) {
    document.getElementById('scanlines').style.display = on ? 'block' : 'none';
  }
  applyCRT(storage.settings.crtFilter);

  document.getElementById('btn-reset-save').addEventListener('click', () => {
    if (confirm('Reset all progress, stats, achievements, and settings?')) {
      storage.resetAll();
      audio.setVolume(storage.settings.masterVolume);
      audio.setEnabled(storage.settings.sfx);
      refreshSettings();
      toast({ name: 'Save Data', desc: 'All progress reset.' });
    }
  });

  // ─── Main-menu news pane "Best: X" hint ──
  function refreshMenuHint() {
    const el = document.getElementById('news-best-score');
    if (!el) return;
    el.textContent = storage.stats.bestScore > 0
      ? storage.stats.bestScore.toLocaleString()
      : 'no runs yet';
  }

  // ─── Stats refresh ────────────────────────
  function refreshStats() {
    const s = storage.stats;
    document.getElementById('st-best-score').textContent  = s.bestScore.toLocaleString();
    document.getElementById('st-best-combo').textContent  = 'x' + s.bestCombo;
    document.getElementById('st-best-arena').textContent  = s.bestArena;
    document.getElementById('st-runs').textContent        = s.totalRuns.toLocaleString();
    document.getElementById('st-kills').textContent       = s.totalKills.toLocaleString();
    document.getElementById('st-dashes').textContent      = s.totalDashes.toLocaleString();
    const mins = Math.floor(s.totalPlaytimeSec / 60);
    const secs = s.totalPlaytimeSec % 60;
    document.getElementById('st-time').textContent        = `${mins}m ${secs}s`;
    const unlocked = Object.keys(storage.achievements).length;
    document.getElementById('st-ach').textContent         = `${unlocked} / ${ACHIEVEMENTS.length}`;
    document.getElementById('st-kpr').textContent = s.totalRuns > 0
      ? (s.totalKills / s.totalRuns).toFixed(1) : '—';
  }

  // ─── Achievements refresh ─────────────────
  function refreshAchievements() {
    const list = document.getElementById('ach-list');
    list.innerHTML = '';
    for (const a of ACHIEVEMENTS) {
      const unlocked = storage.hasAchievement(a.id);
      const row = document.createElement('div');
      row.className = 'ach-row' + (unlocked ? ' unlocked' : '');
      row.innerHTML = `
        <div class="ach-icon">${unlocked ? a.icon : '?'}</div>
        <div class="ach-body">
          <div class="ach-name">${a.name}</div>
          <div class="ach-desc">${unlocked ? a.desc : '???'}</div>
        </div>
      `;
      list.appendChild(row);
    }
    const pct = Math.round((Object.keys(storage.achievements).length / ACHIEVEMENTS.length) * 100);
    document.getElementById('ach-progress').textContent = pct + '%';
  }

  // ─── Toast ────────────────────────────────
  function toast(def, variant = 'default') {
    const layer = document.getElementById('toast-layer');
    const el = document.createElement('div');
    el.className = 'toast' + (variant === 'achievement' ? ' achievement' : '');
    const head = variant === 'achievement' ? 'Achievement Unlocked' : 'Notice';
    el.innerHTML = `<div class="t-head">${head}</div><div class="t-body">${def.name}</div>`;
    layer.appendChild(el);
    if (variant === 'achievement') audio.achievement();
    setTimeout(() => el.remove(), 3800);
  }

  // ─── Version tag ──────────────────────────
  const versionEl = document.getElementById('version-tag');
  if (window.neon && window.neon.version) {
    window.neon.version().then(v => versionEl.textContent = 'v' + v);
  } else {
    versionEl.textContent = 'web build';
  }

  // ─── Auto-update bar ──────────────────────
  if (window.neon && window.neon.onUpdateReady) {
    window.neon.onUpdateReady((info) => {
      const bar     = document.getElementById('update-bar');
      const barText = document.getElementById('update-bar-text');
      const barBtn  = document.getElementById('update-bar-btn');
      // Match main.js's 8-second auto-install timer so the user sees exactly
      // when it's about to happen and can install right now if they prefer.
      let secs = 8;
      const render = () => {
        barText.innerHTML = `UPDATE READY &nbsp;&mdash;&nbsp; <span>v${info.version}</span> &nbsp;&middot;&nbsp; auto-install in ${secs}s`;
      };
      render();
      bar.style.display = 'flex';
      barBtn.textContent = 'INSTALL NOW';
      barBtn.onclick = () => window.neon.installUpdate();
      const tick = setInterval(() => {
        secs -= 1;
        if (secs <= 0) { clearInterval(tick); barText.innerHTML = `INSTALLING v${info.version}&hellip;`; }
        else render();
      }, 1000);
    });
  }

  // ─── Start game ───────────────────────────
  function startGame() {
    document.getElementById('launcher-root').style.display = 'none';
    document.getElementById('game-root').style.display = 'block';
    // Unlock audio on first user gesture
    audio.unlock();
    NeonPulseGame.start({
      onExit: (runResult) => {
        document.getElementById('game-root').style.display = 'none';
        document.getElementById('launcher-root').style.display = 'block';
        audio.startAmbient();
        refreshStats();
        refreshAchievements();
        refreshMenuHint();
      },
    });
  }

  // ─── Window controls ──────────────────────
  if (window.neon && window.neon.isElectron) {
    document.getElementById('win-min').addEventListener('click', () => window.neon.minimize());
    document.getElementById('win-full').addEventListener('click', () => window.neon.toggleFullscreen());
    document.getElementById('win-close').addEventListener('click', () => window.neon.quit());
  } else {
    document.getElementById('window-controls').style.display = 'none';
    document.getElementById('drag-region').style.display = 'none';
  }

  // ─── Start ambient on first click ─────────
  const firstClickUnlock = () => {
    audio.unlock();
    audio.startAmbient();
    document.removeEventListener('click', firstClickUnlock);
    document.removeEventListener('keydown', firstClickUnlock);
  };
  document.addEventListener('click', firstClickUnlock);
  document.addEventListener('keydown', firstClickUnlock);

  // Initial screen
  showScreen('screen-menu');
  refreshMenuHint();

  // Keep "Best" hint fresh after runs return to menu
  const origStart = startGame;
})();

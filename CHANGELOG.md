# Changelog

All notable changes to Neon Pulse are documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.4.0] - 2026-04-19 — THE WORKSHOP UPDATE

### Added
- **WORKSHOP** menu button leading to a community-arena browser (`src/index.html`, `src/js/launcher.js`). Browse featured arenas, your own creations, and arenas imported from share codes. Each card shows wave count, lives, score multiplier, and your personal best.
- **ARENA FORGE** in-game editor (`src/js/forge.js`): design fully custom challenges. Set name, author, description, lives (1-5), enemy-speed multiplier (0.5x-2.5x), score multiplier (0.5x-3.0x), and up to 10 waves. Each wave configures duration, spawn count, enemy-type pool (basic / fast / tank / shooter / splitter), and an optional BOSS flag.
- **Share codes** (`NP1:` prefix + URL-safe base64): one-line portable strings. Post them on Discord / Reddit / Twitter and anyone can paste to import, play, and post their high score. Deterministic id derived from the code so leaderboards converge across users.
- **Featured starter arenas** (hand-curated by OutBlade): *BULLET HELL* (shooters-only gauntlet ending in a boss), *THE BLENDER* (splitter soup for guaranteed multi-kills), *SPEEDRUN ANY%* (everything +60% speed, score x3).
- **Per-arena scoreboards** in `storage.js` (`recordArenaRun` / `getArenaScore`): best score and best wave are tracked per arena id so each workshop creation has its own leaderboard.
- New game entry point `NeonPulseGame.startCustom({ arena, onExit })` that overrides wave spawning, enemy speeds, starting upgrades, lives, and score multipliers — respecting all the Forge rule knobs.
- `ARENA COMPLETE` summary screen (reuses gameover panel) shown when the final custom wave is cleared.

### Changed
- `storage.js` schema extended with `customArenas` and `arenaScores` maps. Existing saves deep-merge with defaults so upgrading is non-breaking.
- `index.html` includes `<script src="js/forge.js">` and two new screen sections (`#screen-workshop`, `#screen-forge`).
- `launcher.css` gains a full suite of Workshop / Forge styles (arena cards, forge rows, wave rows, enemy-pool chips).

### Notes
- Schema is versioned (`v: 1`). Future additions can extend the object without breaking existing share codes.
- Defensive validation (`validate()` in `forge.js`) clamps every imported field so malicious or malformed codes can't crash the game.

## [0.3.1] - 2026-04-18 — AGGRESSIVE AUTO-UPDATE

### Changed
- `main.js`: on `update-downloaded`, schedule `quitAndInstall` automatically after 8 seconds so updates install without requiring a button click. The in-app banner still offers INSTALL NOW for anyone who wants it immediately.
- `main.js`: periodic update re-check every 15 minutes while the app is running, in addition to the 5s post-launch check. Long sessions pick up new versions without restart.
- `src/js/launcher.js`: update banner shows a live countdown ("auto-install in 8s") and switches to "INSTALLING v0.3.1..." when the timer fires.

## [0.3.0] - 2026-04-18 — THE VIRAL UPDATE

### Added
- **CURSED upgrade tier** (`src/js/game.js`): five high-risk, high-reward, high-meme upgrades — Glass Cannon (x2 score, 1 life), Caffeine Overdose (+30% global speed), Honey I Shrunk The Hitbox (2x dash radius, 1.4x player size), The Gambler (coin-flip kill bonus), All Gas No Brakes (zero dash cooldown). Roll weight 3% per upgrade slot.
- **Kill callouts** for dash multi-kills: DOUBLE / TRIPLE / QUAD PULSE / RAMPAGE / CHAOS PROTOCOL / POLYGON ANNIHILATION / DIGITAL GENOCIDE / UNSTOPPABLE. Rising animated HUD text designed for streamer clips.
- **Run-summary PNG card** (`buildSummaryCard()`): 1200x630 shareable image generated on SHARE button — score hero, stats row, generated epithet, auto-downloads as PNG.
- **Meme death cam**: 650ms freeze-frame on death before the game-over panel lands, with a rotating last-words quote (`LAST_WORDS` pool) shown above the stats.
- **News / patch-notes pane** on main menu (`src/index.html`): Steam-style panel pinned next to the menu buttons with version, patch highlights, and best-score hint.
- **Frame rate cap** setting in the Settings screen: 30 / 60 / 120 / 144 / UNCAPPED via `NEON.storage.settings.fpsCap`; enforced by a skip-frame throttle in the main loop.

### Changed
- **Enemy sprite cache** (`getEnemySprite()` in `src/js/game.js`): basic / baby / tank / splitter enemies are now baked into offscreen canvases once per (type, radius, color) key. Dramatically reduces per-frame `shadowBlur` cost — the single most expensive 2D-canvas operation.
- **Arena ring cache** (`getArenaSprite()`): static arena ring + radial-gradient fill are painted once per window-size and drawn with `drawImage` thereafter; invalidated on resize.
- **Audio noise buffer shared** (`_getNoiseBuffer()` in `src/js/audio.js`): the 1-second white-noise `AudioBuffer` is created once and reused instead of allocated per SFX.
- `package.json` bumped to v0.3.0 so existing installs see an auto-update banner.

### Fixed
- Score-mult / global-speed-mult flags in `stats` now feed through `spawnEnemy()` and `killEnemy()` so cursed upgrades actually mutate gameplay.

## [Unreleased] - 2026-04-17

### Added
- Wave-clear prompt in `src/js/game.js`: all enemies dead triggers an immediate NEXT WAVE button (Enter key also works) so players advance arenas without waiting for a countdown timer.
- `docs/game/styles/game.css` and `src/styles/game.css`: wave-clear prompt and update-bar UI styles.
- Update bar element in `src/index.html` wired to auto-updater IPC events.
- Landing page (`docs/index.html`) synced with SmartScreen bypass notice and per-user install callout; download link updated to v0.2.0.
- `docs/game/` browser build fully synced with all `src/` changes from this session.

### Changed
- `package.json` bumped to v0.2.0 so existing v0.1.0 installs receive an auto-update notification.
- NSIS installer switched to `perMachine: false` + `allowElevation: false`; install target is now `%LOCALAPPDATA%\Programs\Neon Pulse`, removing the admin-rights requirement.
- `package.json`: added `artifactName` producing `NeonPulseSetup-${version}.exe` for stable download URLs.
- `main.js`: `verifyUpdateCodeSignature: false` so unsigned builds deliver updates via sha512 hash; added lifecycle log events and `channel: 'latest'` with `allowPrerelease: false`.

### Fixed
- `src/js/game.js`: frame-rate-dependent physics replaced with delta-time scaling (`dtScale = rawDt / 16.6`) so game speed is consistent at 60 Hz, 144 Hz, and any refresh rate.
- Temporal Field (Slowmo upgrade) now correctly slows enemy movement, not just timers.
- ESC and P keys blocked while upgrade screen is visible, closing the infinite-reroll exploit (`src/js/game.js`).
- Shockwave upgrade nerfed: base expansion speed reduced from 9 to 5 (per-level bonus from +2 to +1.5), hit window narrowed from 20 to 12 px.

### Notes
- `production/health-log.md` and `production/balance-log.md` do not exist yet; no audit results available.
- No inline `// BALANCE AUDIT` or `// CHANGED` comments found in the last 40 lines of `game.js`, `launcher.js`, or `achievements.js`.

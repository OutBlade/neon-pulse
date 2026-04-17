# NEON PULSE

A precision-dash roguelike set in a neon-drenched void.

Charge your pulse drive, aim with the cursor, release to dash through waves of
hostile drones. Clear arenas, pick upgrades, chase combos. Every run is a
different build, every build ends in chaos.

[![Download for Windows](https://img.shields.io/badge/Download%20for%20Windows-NeonPulseSetup--0.1.0.exe-ff2a6d?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/OutBlade/neon-pulse/releases/download/v0.1.0/NeonPulseSetup-0.1.0.exe)
[![Play in Browser](https://img.shields.io/badge/Play%20in%20Browser-outblade.github.io-05d9e8?style=for-the-badge&logo=googlechrome&logoColor=white)](https://outblade.github.io/neon-pulse/)
[![Release](https://img.shields.io/github/v/release/OutBlade/neon-pulse?style=for-the-badge&color=b967ff)](https://github.com/OutBlade/neon-pulse/releases/latest)

Built as a Steam-ready example using the Claude Code Game Studios framework.
Ships as a standalone Electron app with its own launcher, settings,
statistics, and achievements. Also runs directly in the browser.

## Features

Launcher with main menu, settings, statistics, achievements, and credits.
15 unlockable achievements and persistent cross-run statistics.
15 roguelike upgrades across three rarities (common, rare, legendary).
Five enemy types with distinct behaviors (basic, fast, tank, shooter, splitter).
Procedural Web Audio — no audio files required.
Neon-synthwave aesthetic with particles, chromatic aberration, CRT scanlines, and screen shake (all toggleable).

## Controls

Mouse move: aim
Left mouse button: hold to charge, release to dash
Space: alternate dash (keyboard)
Esc / P: pause
F11: toggle fullscreen (Electron build)

Your ship drifts slowly toward the cursor. Dashing destroys enemies and
projectiles in its path. Longer charges produce longer dashes.

## Run from source

### As a desktop app (Electron)

```
cd neon-pulse
npm install
npm start
```

### In a browser

```
cd neon-pulse
npm run web
```

This opens the game in your default browser via a local static server.
Alternatively, open `src/index.html` directly (CRT filter, save data,
and audio all work from the file:// protocol).

## Build distributables

The project is wired for `electron-builder`, ready to produce signed
installers for Steam upload.

Windows installer (NSIS) and portable exe:
```
npm run dist:win
```

All platforms (run on matching host):
```
npm run dist
```

Outputs land in `dist/`. The NSIS config builds a user-friendly
installer with directory-selection and desktop/start-menu shortcuts.

## Steam packaging notes

Neon Pulse is packaged as a standalone Electron build, which is the
approach used by many indie Steam titles (e.g. Slime Rancher launcher,
Among Us-adjacent games, multiple RPG Maker and HTML5 ports).

Recommended Steam pipeline:

1. Build a Windows x64 portable or NSIS package with `npm run dist:win`.
2. Drop the unpacked build output into your Steam depot via SteamPipe.
3. Add the Steamworks SDK (`steam_api64.dll`) next to the executable if
   you want Steam achievements, rich presence, or the overlay. Use the
   `greenworks` or `steamworks.js` native module to bridge Electron to
   Steamworks.
4. Mirror the 15 in-game achievements into your Steam achievements list.
   The IDs are already structured to map 1:1.

## Project structure

```
neon-pulse/
  main.js              Electron main process (window, IPC, shortcuts)
  preload.js           Secure bridge exposing safe window APIs
  package.json         npm + electron-builder config
  src/
    index.html         Launcher + in-game overlay HTML
    styles/
      launcher.css     Menu, settings, stats, achievements UI
      game.css         HUD, combo, upgrade screen, game-over
    js/
      launcher.js      Menu controller, screen routing, toasts
      game.js          Core game loop, arenas, upgrades, rendering
      audio.js         Procedural Web Audio engine
      storage.js       localStorage persistence layer
      achievements.js  Achievement definitions + runtime checks
```

## Upgrades

Common (70% roll weight): Extended Arc, Quick Recovery, Rapid Charge, Wider Pulse, Momentum.
Rare (25%): Shockwave, Piercing Pulse, Second Wind, Temporal Field, Magnetic Field.
Legendary (5%): Overdrive, Echo, Ghost Protocol, Scavenger.

## Achievements

First Pulse, Triple Threat, Rhythmbreaker, Harmonic Overload, Deep Signal,
Event Horizon, Neon Pedigree, Overclock, Untouchable, Long Night, Momentum,
Clearance, Static, Loadout Complete, Chosen Frequency.

Unlocks persist across runs in `localStorage`. The Electron build stores
its `localStorage` per user in the standard Chromium profile directory.

## License

MIT. See `LICENSE` if present, or treat the source as MIT-licensed.

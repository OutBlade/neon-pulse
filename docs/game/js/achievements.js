// NEON PULSE — Achievement definitions and runtime checking

const ACHIEVEMENTS = [
  { id: 'first_pulse',      name: 'First Pulse',       desc: 'Complete your first run.',                   icon: '◆' },
  { id: 'triple_kill',      name: 'Triple Threat',     desc: 'Kill 3 enemies in a single dash.',           icon: '✕' },
  { id: 'combo_10',         name: 'Rhythmbreaker',     desc: 'Reach a x10 combo.',                          icon: '♪' },
  { id: 'combo_25',         name: 'Harmonic Overload', desc: 'Reach a x25 combo.',                          icon: '♫' },
  { id: 'arena_5',          name: 'Deep Signal',       desc: 'Clear arena 5.',                              icon: '⬢' },
  { id: 'arena_10',         name: 'Event Horizon',     desc: 'Clear arena 10.',                             icon: '⬡' },
  { id: 'score_10k',        name: 'Neon Pedigree',     desc: 'Score 10,000 in a single run.',               icon: '★' },
  { id: 'score_50k',        name: 'Overclock',         desc: 'Score 50,000 in a single run.',               icon: '✦' },
  { id: 'perfect_arena',    name: 'Untouchable',       desc: 'Clear an arena without taking damage.',       icon: '◉' },
  { id: 'survivor',         name: 'Long Night',        desc: 'Survive 5 minutes in a single run.',          icon: '◐' },
  { id: 'dash_100',         name: 'Momentum',          desc: 'Dash 100 times across all runs.',             icon: '➤' },
  { id: 'kill_1000',        name: 'Clearance',         desc: 'Kill 1,000 enemies across all runs.',         icon: '⚑' },
  { id: 'pacifist_fail',    name: 'Static',            desc: 'Die without dashing once.',                   icon: '◌' },
  { id: 'full_build',       name: 'Loadout Complete',  desc: 'Stack 8 upgrades in a single run.',           icon: '⊞' },
  { id: 'legendary',        name: 'Chosen Frequency',  desc: 'Pick a legendary upgrade.',                   icon: '♛' },
];

class AchievementManager {
  constructor(storage, onUnlock) {
    this.storage  = storage;
    this.onUnlock = onUnlock || (() => {});
  }

  _unlock(id) {
    const wasNew = this.storage.unlockAchievement(id);
    if (wasNew) {
      const def = ACHIEVEMENTS.find(a => a.id === id);
      if (def) this.onUnlock(def);
    }
    return wasNew;
  }

  // Called with run snapshots and key events from the game loop
  checkOnKill({ killsThisDash, totalKillsAllTime }) {
    if (killsThisDash >= 3) this._unlock('triple_kill');
    if (totalKillsAllTime >= 1000) this._unlock('kill_1000');
  }
  checkOnCombo(combo) {
    if (combo >= 10) this._unlock('combo_10');
    if (combo >= 25) this._unlock('combo_25');
  }
  checkOnArenaClear({ arenaNum, perfectArena }) {
    if (arenaNum >= 5)  this._unlock('arena_5');
    if (arenaNum >= 10) this._unlock('arena_10');
    if (perfectArena)   this._unlock('perfect_arena');
  }
  checkOnScore(score) {
    if (score >= 10000) this._unlock('score_10k');
    if (score >= 50000) this._unlock('score_50k');
  }
  checkOnDashTotal(totalDashes) {
    if (totalDashes >= 100) this._unlock('dash_100');
  }
  checkOnRunEnd({ score, dashes, playtimeSec, upgradesPicked }) {
    this._unlock('first_pulse');
    if (playtimeSec >= 300) this._unlock('survivor');
    if (dashes === 0) this._unlock('pacifist_fail');
    if (upgradesPicked >= 8) this._unlock('full_build');
  }
  checkOnUpgradePick(rarity) {
    if (rarity === 'legendary') this._unlock('legendary');
  }
}

window.ACHIEVEMENTS = ACHIEVEMENTS;
window.AchievementManager = AchievementManager;

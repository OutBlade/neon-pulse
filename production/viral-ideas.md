# Neon Pulse — Viral Feature Ideas

---

## 2026-04-18 — Death Pulse

**Feature name:** Death Pulse

**Rationale:** Right now, dying resets the combo and plays a generic red explosion — nothing memorable for a clip. Death Pulse turns the moment of lethal impact into a spectacle: when the player's last life is taken while holding a combo of 5 or higher, the player's body detonates in a massive radial shockwave that deals damage proportional to the combo count, shreds nearby enemies, and fills the screen with a white-hot flash and "DEATH PULSE" floating text before the life-loss and game-over sequence proceed normally. The death still happens — this is not a save — which keeps risk real and makes clips credible ("I died AND took half the screen with me"). It directly embodies the "Rewarding Deaths" pillar, creates a reliable streamer highlight in under 5 seconds of footage, and is mechanically novel because no existing upgrade or system grants offensive power on death. The combo requirement ensures it only fires when the player was doing well, so the explosion arrives exactly when viewers are already engaged.

**Implementation sketch (src/js/game.js, function hitPlayer, ~line 983):**

1. After `player.lives -= 1;` (line 985), add a conditional block before the existing `if (player.lives <= 0) gameOver();` check:

```js
if (player.lives <= 0 && combo.value >= 5) {
  const pulseRadius = 90 + combo.value * 7;          // ~130–270px depending on combo
  const pulseDmg    = Math.max(1, Math.floor(combo.value / 4));
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (dist(enemies[i], player) < pulseRadius + enemies[i].radius) {
      damageEnemy(i, pulseDmg);                       // use existing damageEnemy()
    }
  }
  // Big particle burst — reuse spawnExplosion with white-hot color and inflated count
  for (let k = 0; k < 3; k++) spawnExplosion(player.x, player.y, '#ffffff', 30);
  triggerShake(28);                                    // double the normal death shake
  // Floating "DEATH PULSE" label at player position
  damageNumbers.push({ x: player.x, y: player.y - 20, val: 'DEATH PULSE', life: 1.4,
                        color: '#ff2a6d', scale: 1.6 });
}
```

2. No new files needed. `damageEnemy(i, dmg)` already exists in the game loop (search for `function damageEnemy` or inline enemy-hp logic and extract if not already a named function — if it is inlined, replicate the three-line hp-decrement + removeEnemy pattern directly in the loop above).

3. Optionally add an achievement "Last Spark" (die with a 10+ combo, triggering Death Pulse) — one entry in achievements.js and one `checkOnDeathPulse(combo)` call after the pulse fires.

**Streamer moment:** Visible from across the room. A huge white radial flash clears enemies, "DEATH PULSE" floats up in neon-red, then the screen cuts to game over. Clips itself in 3 seconds.

**Estimated dev time:** 45–60 minutes including testing edge cases (1-life run, zero combo, boss fight).

---

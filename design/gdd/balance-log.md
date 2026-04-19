# Balance Log

## 2026-04-18 — Automated audit (scheduled task)

No design/gdd/combat-system.md found; audit evaluated against the principles embedded in the task specification.

Arena enemy counts for arenas 1-12 (formula: 12 + (num-1) * 6):
1: 12, 2: 18, 3: 24, 4: 30, 5: boss, 6: 42, 7: 48, 8: 54, 9: 60, 10: boss, 11: 72, 12: 78

Speed multiplier per arena (post-fix): 1 + (arenaNum - 1) * 0.035
Examples: arena 1 = 1.00x, arena 6 = 1.175x, arena 10 = 1.315x, arena 12 = 1.385x

Changes made to src/js/game.js:

- Boss HP formula changed from `10 + tier*6` to `6 + tier*4`. Arena 5 boss: 16 HP reduced to 10; arena 10 boss: 22 HP reduced to 14. Both now fall within the 8-15 dash-hit target.
- Per-arena speed scaling added in spawnEnemy(): each regular enemy spawned 3.5% faster per arena above 1. Arenas 6-12 previously had no speed increase over arena 1, making the escalation feel purely numerical rather than skill-demanding.
- IFRAMES_MS reduced from 1200 to 800. At 1200ms, a player could dash three times (3 x 360ms cooldown) while fully invincible after each hit, eliminating meaningful post-hit risk. At 800ms the player can dash twice and faces roughly a 400ms vulnerable window before the next cooldown expires.
- Arena 1 (12 basic enemies, speed 1.0x, batches of 2 every 660ms) was not changed; it meets the 20-second survivability threshold with default 3 lives and 800ms iframes.
- Dash cooldown (360ms) itself was not changed; the between-dash vulnerability window of ~360ms is considered appropriately tight for a precision-dash genre.

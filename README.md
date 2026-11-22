# Neon Bay Nights

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Vikkry88/neon-bay-nights/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Vikkry88/neon-bay-nights/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01).
Explore **Neon Bay** — a sun-soaked top-down city of beachfront, marina, downtown
towers and old-town streets — on foot and by car. Run ten story jobs for the
fixer **Marlowe**, build respect in four districts, and stay ahead of a five-tier
police dispatch that escalates from patrol cars to roadblocks and helicopter air
support.

## Features

- A living city: traffic with working lights, pedestrians, parked cars, parks,
  beaches and neon signs, all drawn in code — no external assets.
- Steal and drive any car (E), or run the streets on foot.
- Ten sequential story jobs with briefs, timers and cash rewards ($500–$5,000).
- Five wanted stars with named dispatch tiers: Patrol, Interceptor, Roadblock,
  Air Support, Maximum Response — plus a helicopter with a spotlight at 3+ stars.
- Weapon wheel (hold Q, or keys 1–4): Fists, Pistol, SMG, Shotgun, with pickups
  and ammo.
- District respect across Downtown, Beachfront, Old Town and Marina.
- Car radio with two stations (Neon FM, Bay Talk) and a full HUD: minimap,
  speedometer, mission timer, dispatch banner and Marlowe's dialogue box.
- Pause (P), mute (M), and progress saved in localStorage.

## Play

Serve the `game/` folder with any static file server, or run the bundled one:

```
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. Keyboard and mouse:
WASD/arrows to move and drive, E to enter/exit cars, Shift to sprint/boost,
Space to brake, mouse to aim and shoot, Q for the weapon wheel, R for radio.

## Hand in

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This copies `game/` and `screenshots/` to `out/` and writes `out/dossier.json`.

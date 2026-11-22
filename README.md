[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Vikkry88/neon-bay-nights/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Vikkry88/neon-bay-nights/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Neon Bay Nights — True 3D Open-World Crime Game

Neon Bay Nights is a true-3D, third-person open-world crime game built with Three.js (WebGL). You are a new face in **Neon Bay**, a sun-soaked coastal city of palm boulevards, neon signs, pastel towers, a sand beach, a pier and open ocean. Fixer **Marlowe** has work for you: run jobs, earn cash and respect, steal cars, and outrun the Bay PD — all in one living city you can explore on foot or behind the wheel.

The game is plain static files under `game/` and plays offline in desktop Chrome with no network requests. Three.js is vendored locally under `game/vendor/three/`.

## Play

```bash
node serve.ts
# open http://localhost:8080
```

Hand-in (writes `dossier.json`): `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`

## Features (with numbers)

- **10 sequential story jobs** for fixer Marlowe — First Wheels, Package Run, Hot Ride, Heat Check, Marina Money, Beachfront Chase, Old Town Debt, Air Support, Grand Tour, Neon Bay Nights — with briefs, dialogue, street-point markers, a floating direction arrow, timers and rewards from **$500 to $5,000**.
- **5 named police dispatch tiers**: 1 Patrol, 2 Interceptor, 3 Roadblock, 4 Air Support, 5 Maximum Response — with a live dispatch panel listing each unit, its distance and tactic (RAMMING, FLANKING, SPOTLIGHT, ROADBLOCK).
- **Helicopter air support** from 3 stars up: an orbiting helicopter with spinning rotors, a real SpotLight, a visible light cone and a ground light pool that tracks you.
- **4 weapon slots**: 1 Fists, 2 Pistol, 3 SMG, 4 Shotgun — different damage, fire rate and ammo, with tracers, muzzle flash, punching and pickups that unlock the SMG and Shotgun.
- **4 districts** with respect scores: Downtown, Beachfront, Old Town and Marina — shown in the HUD and earned by completing jobs.
- **8 car models** (Sunset Sedan, Bay Cruiser, Palm GT, Marina Hatch, Neon Coupe, Beach Buggy, Old Town Pickup, Sol Convertible) plus Bay PD Interceptors — steal any car with E, arcade driving that works at crawl speed, handbrake, body roll, condition damage.
- **Living traffic and pedestrians**: 26 traffic cars driving lanes with stuck-timer teleport-ahead so streets never jam, 22 parked cars to steal, 34 pedestrians strolling sidewalks who flee gunfire.
- **A full city**: ocean and beach, palm-lined boulevard, road grid with painted lane markings and crosswalks, pastel low-poly buildings with lit windows, neon signs with text, parks, street lamps, cycling traffic lights, a hospital and Bay Garage landmark, and a pier.
- **Golden-hour look**: gradient sky, sun sprite, drifting clouds, fog, directional + hemisphere lighting and soft shadows.
- **Radio with 2 stations plus Off**: Neon FM and Bay Talk, procedural WebAudio music patterns, cycled with R and shown in the HUD. Procedural engine, siren, gunshots, punches, crashes, horns and cash sounds — no audio files.
- **Dense HUD**: mission card (JOB x/10, STAGE, objective, NEXT, timer), dispatch panel, weapon slots with ammo, circular minimap with player/police/objective/garage blips, big speedometer (km/h + vehicle name + condition), money, clock, wanted stars, health/armor bars, district + respect, radio line, and a Marlowe dialogue box at mission start and stage changes.
- **Wanted system that never pins you**: pursuit steering with standoff distance and push-out, gentle rams with back-off, roadblocks at 3+ stars, 4-second spawn protection, safe spawn, death → WASTED → restart at the hospital.
- **Saves**: money, mission progress, district respect, weapons/ammo, radio and settings persist in localStorage.
- **Controls**: WASD move/drive, E enter/exit car, mouse aim, click or F attack, 1–4 weapons, R radio, H horn, Space handbrake/sprint, P pause, M mute.

## Source layout

- `game/index.html` — page, HUD styles, Three.js import map
- `game/src/main.js` — boot, loop, state, input, combat, shot staging
- `game/src/world.js` — scene, sky, lights, ocean/beach, road-grid ground
- `game/src/city.js` — procedural buildings, palms, signs, lamps, districts
- `game/src/vehicles.js` — car models, traffic AI, parked cars, driving
- `game/src/player.js` — on-foot character, pedestrians, chase camera
- `game/src/police.js` — wanted stars, dispatch tiers, pursuit, roadblocks, helicopter
- `game/src/missions.js` — the 10 Marlowe jobs, markers, timers, dialogue
- `game/src/hud.js` — DOM HUD and minimap canvas
- `game/src/audio.js` — WebAudio engine, siren, shots, radio music
- `game/src/save.js` — localStorage saves

All names, art, story and sounds are original. No assets from any commercial game.

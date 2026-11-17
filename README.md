# Neon Bay Nights

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Vikkry88/neon-bay-nights/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Vikkry88/neon-bay-nights/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A 2D top-down open-world crime game in the browser, built for the [make.fun](https://make.fun/bounty/gta6-01)
**gta6-01 "Make GTA 6"** bounty. Everything is original: the city of Neon Bay,
its people, its story, its art and its sounds — nothing from any commercial game.

You are a driver for hire in Neon Bay, a sun-soaked coastal city. Steal cars,
outrun the Bay PD, and work five jobs for the fixer **Marla Voss** — from a
first set of wheels to the Bay Trust vault job. Earn cash, stay free.

## How to play

Serve the `game/` folder with any static server and open it in a desktop browser:

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

No build step, no network requests: every script, sound and image is a local
file (sounds are synthesized with WebAudio).

### Controls

| Key | Action |
| --- | --- |
| WASD / arrow keys | Move on foot, drive a car |
| Mouse | Aim on foot |
| Click (hold) | Shoot the pistol |
| Space | Punch |
| E | Steal / enter a car, get out of a car |
| Enter | Take the next job from Marla Voss |
| P / Esc | Pause |
| M | Mute sound |

### The city

- A street grid with traffic lights, crosswalks, parks, and a beach with the sea
  along the south edge.
- Traffic cars drive the streets and stop at red lights; pedestrians walk the
  sidewalks and flee from gunfire and speeding cars.
- Parked cars line the kerbs — walk up and press **E** to steal one. Stealing a
  car in traffic, hitting pedestrians or shooting raises your wanted level.

### Wanted level & police

Crimes raise 1–5 stars. Police cruisers chase and ram you; at 2+ stars foot
cops try to arrest you on foot. Hide or outrun them and the heat fades, one
star at a time — a star drops once no cop has been close for a few seconds, and
a cruiser that falls far behind gives up entirely. Get caught and you are
**BUSTED**; lose all your health and you are **WASTED** — either way you lose
$100 in fines and hospital bills.

You spawn in Coral Park with three seconds of protection, away from traffic and
enemies, so the first seconds of every run are safe. On foot, your health creeps
back after a quiet spell, so a long chase rarely ends in a cheap death.

### Missions (from Marla Voss, in order)

1. **First Wheels** ($150) — steal any car, bring it to the garage.
2. **Sunset Run** ($300) — deliver a package to the Salt Air bar on the beach,
   within 90 seconds (the timer shows on screen).
3. **The Getaway** ($450) — pick up Rico, lose the police, reach the safehouse.
4. **Repo Man** ($600) — steal the marked yellow coupe and deliver it to the
   garage in one piece (below 30% condition and the job is blown).
5. **The Bay Trust Job** ($1000) — grab the vault cash, lose the whole Bay PD,
   escape to the safehouse.

Mission objectives are always shown at the top of the screen and marked on the
minimap (bottom left). Completed jobs and cash are saved in `localStorage`, so
your progress survives a restart.

### Combat

- **Space** punches on foot. A pistol pickup sits by the park where you spawn —
  12 rounds, click to shoot, aim with the mouse.
- Rival gunmen appear during the later jobs. Taking one down pays $25.

## Screenshots

The four screenshots in `screenshots/` are staged renders of the real game
(`?shot=city|chase|mission|police&seed=1`): the city on foot, a driving chase
at three stars, the Getaway mission, and the police closing in at four stars.

## Files

- `game/index.html` — the page; `game/src/` — the game, one module per job:
  `main.js` (loop & screens), `world.js` (simulation), `city.js` (map),
  `missions.js` (story & jobs), `render.js` (drawing), `hud.js` + `minimap.js` (HUD),
  `audio.js` (synthesized sound & music), `input.js`, `save.js`, `config.js`,
  `random.js`, `shots.js` (screenshot staging).
- `main.ts` — hands the entry in: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json`.
- `serve.ts` — tiny static server for local play.

## License

MIT — see `LICENSE`.

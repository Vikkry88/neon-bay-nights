# Neon Bay Nights

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Vikkry88/neon-bay-nights/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Vikkry88/neon-bay-nights/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A 2D top-down open-world crime game, built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). You are a driver for hire in **Neon Bay**, a sun-soaked coastal city. Take jobs from the fixer **Marla Voss**, steal cars, outrun the Bay PD, and work your way up to the Bay Trust Job.

Everything is original: the city, the characters, the story, the art and the music are all made for this game. No assets from any commercial game.

## The city

Neon Bay is a full open world: a street grid with traffic lights, beach and boardwalk on the coast, parks, a garage, a safehouse, the Salt Air bar, and the Bay Trust vault. Traffic cars cruise the streets, pedestrians walk the sidewalks, and the Bay PD patrols — until you give them a reason not to.

## Missions (from Marla Voss, in order)

1. **First Wheels — $150.** Steal any car and bring it to the garage.
2. **Sunset Run — $300.** Deliver a package to the Salt Air bar on the beach within 90 seconds.
3. **The Getaway — $450.** Pick up Rico, lose the police, reach the safehouse.
4. **Repo Man — $600.** Steal the marked yellow coupe and deliver it to the garage in one piece — below 30% condition and the job is blown.
5. **The Bay Trust Job — $1000.** Grab the vault cash, lose the whole Bay PD, escape to the safehouse.

## Features

- Open world on foot and by car, with a smooth following camera
- Cars to steal (walk up and press **E**), arcade driving that answers at any speed
- Wanted level, 1–5 stars: black-and-white police cruisers chase and ram (rarely, and never while you are parked), foot cops arrest; lay low to cool off
- Combat on foot: punch (**Space**) and a pistol pickup by the garage, marked by a glowing beacon, with ammo in the HUD
- HUD with live minimap, wanted stars, cash, health, speed, mission objective and distance to it
- Title screen, pause, mission complete/fail screens, WASTED / BUSTED screens
- Progress saved to localStorage (money and missions completed)
- Particles, explosions, screen shake, synthesized WebAudio sound effects and a music loop (**M** to mute)

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Move / drive |
| Mouse | Aim on foot, click to shoot |
| Space | Punch / shoot (with pistol) |
| E | Steal / enter car, exit car |
| Shift | Sprint on foot |
| P / Esc | Pause |
| M | Mute |
| Enter | Start / continue |

## How to run

No build step, no network needed at runtime — every file is local.

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. Or serve `game/` with any static file server.

## License

MIT — see [LICENSE](LICENSE).

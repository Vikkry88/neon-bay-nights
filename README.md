# Neon Bay Nights

![gta6-01](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/Vikkry88/neon-bay-nights/rank.svg)
![reward](https://make.fun/badge/gta6-01/Vikkry88/neon-bay-nights/reward.svg)

A 2D top-down open-world crime game set in **Neon Bay**, built for the
[make.fun "Make GTA 6" bounty (gta6-01)](https://make.fun/bounty/gta6-01).
Everything here is original — no Rockstar/GTA names, characters, maps, art or
music. Play it in the browser: walk the neon streets, steal cars, run five
fixer missions, grab the pistol, and outrun the police.

**Play:** https://vikkry88.github.io/neon-bay-nights/

## How to play

- **WASD / Arrow keys** — walk on foot, drive when in a car
- **E** — enter / exit a car (steal parked cars, or jack traffic cars)
- **Mouse** — aim · **Click** — shoot (find the glowing **PISTOL** beacon first)
- **Shift** — run · **Space** — handbrake · **P / Esc** — pause · **Enter** — start / respawn

Follow the **gold marker** and the stage-aware mission banner at the top:

1. **Night Package** — pick up a package, deliver it to the **GARAGE** yellow ring
2. **Hot Wheels** — steal the marked target car, deliver it to the garage
3. **Cash Drops** — collect 3 cash drops across the city
4. **Lose the Heat** — reach the hideout and shake your wanted stars
5. **Bay Courier** — pick up a parcel and run it to the drop-off

Crime raises your **wanted level** (1–5 stars). Police cruisers chase you but
keep a safe standoff — they never pin you, so you can always drive away, even
slowly. Traffic keeps flowing and never blocks a street forever. If you are
taken out, you respawn at the garage with a small hospital fee. Progress
(money + mission) saves automatically in your browser.

## Run locally

```sh
node serve.ts          # serves game/ on http://localhost:8080
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # build the make.fun dossier
```

Static files only — no build step, no network requests. The game lives in
`game/` (`index.html` + ES modules in `game/src/`), with synthesized WebAudio
sound effects (engine, shots, sirens, cash). Screenshots are in `screenshots/`.

## Tech notes

- Canvas 2D, keyboard + mouse, seeded city generation (street grid, buildings,
  neon signs, parks)
- Police AI with a 72px minimum standoff and corner-pocket back-off
- Jam-proof traffic (stuck cars respawn), low-speed steering with no dead zone
- All mission targets snap to streets so they are always reachable by car
- HUD (health, money, wanted stars, objective), minimap, start/pause/death
  menus, localStorage save

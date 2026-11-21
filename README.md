# Neon Bay Nights

A 2D top-down open-world crime game for make.fun bounty gta6-01 ("Make GTA 6").
All names, art and music are original — the fictional coastal city of Neon Bay,
with fixer Marlowe handing out jobs. No third-party game assets are used.

## Play

Open `game/index.html` in a desktop browser, or run a local server:

    node serve.ts
    # then open http://localhost:8080

No build step and no network requests at runtime: every script is a file
under `game/` loaded as an ES module.

## Controls

- WASD / arrows — walk and drive (low-speed steering stays responsive)
- E — steal / enter / exit a car
- Mouse — aim on foot; click to punch or shoot the pistol
- Enter — start game / take the next fixer job
- P — pause, M — mute, R — restart after game over

## What is inside

Street grid with buildings, parks, beach and sea, traffic lights, driving
traffic, sidewalk pedestrians, car theft, a 1–5 star wanted system with
police cars and foot cops, five fixer missions with street-placed targets
and a yellow garage ring, pistol pickup with a glowing beacon and visible
tracers, cash progression, a canvas minimap, title / pause / mission /
game-over screens, localStorage saving, particles, screen shake and
synthesized WebAudio sound with a small music loop.

Police keep a standoff distance instead of pinning the player, back off
after gentle rams, and let a cornered player escape, so a slow drive to
the garage stays possible with heat active. Traffic despawns and
re-routes instead of gridlocking forever.

## Hand-in

    mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

writes `out/game/`, `out/screenshots/` and `out/dossier.json`.
Screenshots are staged with `?shot=cover|chase|mission|police` (see `shots.json`).

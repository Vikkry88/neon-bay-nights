# Neon Bay Nights

An original top-down open-world crime game for the browser, built for make.fun's
gta6-01 bounty ("Make GTA 6"). You are a fixer-for-hire in **Neon Bay**, a
sun-soaked coastal city of neon signs, beachfront boulevards and a working
marina. Your contact **Marlowe** feeds you ten story jobs across four districts
— Downtown, Beachfront, Old Town and the Marina — while the Neon Bay police
escalate from Patrol cars to Interceptors, Roadblocks, Air Support and Maximum
Response.

Everything is original: the city, names, story, art and music were made for this
game. No assets, names or maps from any commercial game.

## Play

Open `game/index.html` in a desktop browser (or run `node serve.ts` and visit
http://localhost:8080). No network is used at runtime; every file is local.

- **Move / drive:** WASD or arrow keys (Shift to sprint on foot)
- **Enter / exit car:** E — steal any car, parked or in traffic
- **Aim & fire:** mouse aim, hold click to shoot
- **Weapon wheel:** hold Q, or keys 1–4 (Fists, Pistol, SMG, Shotgun)
- **Radio:** R cycles Neon FM / Bay Talk / Off
- **Pause:** P or Esc · **Mute:** M
- **Restart after death:** Enter

## What's inside

- A full city grid with beach and sea, parks, buildings, traffic lights, neon
  signs, dense traffic, pedestrians and parked cars.
- On-foot and driving with jam-proof traffic and police that never pin you:
  standoff distance, gentle rams with back-off, corner-pocket escape.
- A 1–5 star wanted system with named dispatch tiers, roadblocks and a police
  helicopter with a spotlight at higher heat.
- Ten sequential story jobs from Marlowe ($500–$5,000), district respect that
  grows as you work each neighbourhood, a yellow garage ring that cools your
  heat, weapon pickups, a speedometer, minimap, particles, screen shake and a
  WebAudio soundtrack. Progress saves to localStorage.

## Build / hand in

`mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` copies `game/` and
`screenshots/` to `out/` and writes `out/dossier.json`. Screenshots are staged
in-game with `?shot=cover|wheel|mission|police&seed=1`.

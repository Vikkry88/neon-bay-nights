// Neon Bay Nights — a gta6-01 entry (Node 24, standard library only): the game is this
// directory's game/ folder, plain static files a desktop browser loads offline
// (game/index.html and its ES modules, no library and no network request), and this
// program hands it in. It copies game/ and screenshots/ from beside this file to
// /output and writes /output/dossier.json, the summary the judge reads, with the
// vendored make.fun library.
//
// The game is "Neon Bay Nights": a 2D top-down open-world crime game set in the fictional
// sun-soaked coastal city of Neon Bay. Explore on foot and by car, steal cars, dodge the
// police, work missions for the fixer Marla Voss, and earn cash. All original: own city,
// names, story, art and sounds — nothing from any commercial game.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail fast with a clear error instead of handing in a broken entry: the game must
// exist and at least one screenshot must be present (the gate wants 3 or 4).
const gameIndex = join(here, 'game', 'index.html');
if (!existsSync(gameIndex)) {
  throw new Error(`Neon Bay Nights: ${gameIndex} is missing — the game was not built.`);
}
const shotsDir = join(here, 'screenshots');
if (!existsSync(shotsDir)) {
  throw new Error(`Neon Bay Nights: ${shotsDir} is missing — take the screenshots first.`);
}
// The gate wants 3 or 4 screenshots, each at most 256 KiB: refuse to hand in a set
// the scorer would refuse, instead of discovering it after the fact.
const shotFiles = readdirSync(shotsDir).filter((name) => !name.startsWith('.'));
if (shotFiles.length < 3 || shotFiles.length > 4) {
  throw new Error(`Neon Bay Nights: expected 3-4 screenshots, found ${shotFiles.length}.`);
}
for (const name of shotFiles) {
  const size = statSync(join(shotsDir, name)).size;
  if (size > 262144) throw new Error(`Neon Bay Nights: screenshot ${name} is ${size} bytes, over the 256 KiB cap.`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

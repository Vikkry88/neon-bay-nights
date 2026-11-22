// Neon Bay Nights — make.fun gta6-01 hand-in program.
// The playable game lives in game/ beside this file: a Three.js open-world
// crime game made of plain static files that run offline in a browser.
// This program copies game/ and screenshots/ into the output folder and
// writes dossier.json there using the vendored make.fun library.
// Node 22, standard library only, no network, no installs.
// Local play:  node serve.ts
// Local check: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(here, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// Caps mirror the gta6-01 gate: 160 KiB of source text in the dossier,
// at most 4 screenshots of 256 KiB, at most 993 entries / 48 MiB in game/.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

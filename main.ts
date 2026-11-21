// Neon Bay Nights — hand-in script for make.fun bounty gta6-01.
// Copies the static game/ folder and screenshots/ into the output
// directory and writes dossier.json via the vendored make.fun helper.
// Run locally with:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
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
// Fail loudly if the game folder is missing, so a broken hand-in is
// caught here instead of silently shipping an empty dossier.
if (!existsSync(join(here, 'game', 'index.html'))) {
  throw new Error('game/index.html missing — nothing to hand in');
}
console.log('Neon Bay Nights handed in to ' + outDir);

// Neon Bay Nights — make.fun gta6-01 entry program (Node 22, standard library only).
// The game is the static site under game/ (plain files, no network at runtime).
// This program copies game/ and screenshots/ next to itself into the output
// directory and writes dossier.json with the kit's buildDossier, byte for byte
// what the scorer rebuilds. Outside the grader, MAKEFUN_OUTPUT_DIR stands in
// for /output:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play locally with:  node serve.ts   then open http://localhost:8080

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

if (!existsSync(join(root, 'game', 'index.html'))) {
  throw new Error('game/index.html is missing — nothing to hand in');
}

mkdirSync(outDir, { recursive: true });
cpSync(join(root, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(root, 'screenshots'))) {
  cpSync(join(root, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// Caps mirror the scorer's gate: dossier text 160 KiB, at most 4 screenshots of
// 256 KiB each, game/ at most 993 entries and 48 MiB, paths at most 1000 bytes.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`Neon Bay Nights handed in: dossier.json ${dossier.length} bytes -> ${outDir}`);

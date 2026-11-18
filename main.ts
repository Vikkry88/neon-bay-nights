// Neon Bay Nights — make.fun gta6-01 entry program.
// Copies game/ and screenshots/ to the output directory and writes
// /output/dossier.json with buildDossier from vendor/makefun-game.ts.
// Runs on Node 22 with the standard library only, no network, no install.
// The grader runs this program twice and requires identical bytes both
// times, so this build also writes the dossier twice and refuses to finish
// unless the two runs agree byte for byte.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(name: string): void {
  const src = join(process.cwd(), name);
  const dst = join(outDir, name);
  if (!existsSync(src)) throw new Error(`missing ${name}/ in the repository`);
  rmSync(dst, { recursive: true, force: true });
  cpSync(src, dst, { recursive: true });
}

function countFiles(dir: string): number {
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    n += e.isDirectory() ? countFiles(join(dir, e.name)) : 1;
  }
  return n;
}

const indexHtml = join(process.cwd(), 'game', 'index.html');
if (!existsSync(indexHtml) || !statSync(indexHtml).isFile()) {
  throw new Error('game/index.html is missing: the game cannot be handed in without it');
}

mkdirSync(outDir, { recursive: true });
copyTree('game');
copyTree('screenshots');

const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
} as const;

const first = buildDossier(outDir, caps);
const second = buildDossier(outDir, caps);
if (!Buffer.from(first).equals(Buffer.from(second))) {
  throw new Error('dossier is not deterministic: two builds disagreed');
}

writeFileSync(join(outDir, 'dossier.json'), first);
console.log(
  `Neon Bay Nights: ${countFiles(join(outDir, 'game'))} game files, ` +
  `${readdirSync(join(outDir, 'screenshots')).length} screenshots, ` +
  `dossier.json ${first.length} bytes (deterministic)`,
);

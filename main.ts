// Neon Bay Nights — entry program for the make.fun gta6-01 bounty.
// Copies game/ and screenshots/ into the output directory and writes
// /output/dossier.json from vendor/makefun-game.ts. Node 22 standard
// library only; no network, no install. The scorer runs this program
// twice and requires identical bytes both times, so the dossier is built
// twice here and the run refuses to finish unless both agree.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(name: string): void {
  const src = join(process.cwd(), name);
  const dst = join(outDir, name);
  if (!existsSync(src)) throw new Error(`Neon Bay Nights: ${name}/ is missing from the repository`);
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

const indexPath = join(process.cwd(), 'game', 'index.html');
if (!existsSync(indexPath) || !statSync(indexPath).isFile()) {
  throw new Error('Neon Bay Nights: game/index.html is missing, the game cannot be handed in without it');
}

mkdirSync(outDir, { recursive: true });
copyTree('game');
copyTree('screenshots');

// The dossier refuses screenshots past its cap, but a missing one is a
// quieter failure — catch it here, before the build runs, so a bad
// screenshot step fails loudly instead of handing in a thin entry.
const shotFiles = readdirSync(join(outDir, 'screenshots')).filter((f) => /\.(png|jpe?g)$/i.test(f));
if (shotFiles.length < 3 || shotFiles.length > 4) {
  throw new Error(`Neon Bay Nights: screenshots/ holds ${shotFiles.length} images, need 3 or 4`);
}
const entryPoint = join(process.cwd(), 'game', 'src', 'main.js');
if (!existsSync(entryPoint) || !statSync(entryPoint).isFile()) {
  throw new Error('Neon Bay Nights: game/src/main.js is missing, the game loop has no home');
}

const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
} as const;

const first = buildDossier(outDir, caps);
const second = buildDossier(outDir, caps);
if (!Buffer.from(first).equals(Buffer.from(second))) {
  throw new Error('Neon Bay Nights: dossier is not deterministic, two builds disagreed');
}

writeFileSync(join(outDir, 'dossier.json'), first);
console.log(
  `Neon Bay Nights: ${countFiles(join(outDir, 'game'))} game files, ` +
  `${readdirSync(join(outDir, 'screenshots')).length} screenshots, ` +
  `dossier.json ${first.length} bytes (deterministic)`,
);

// Coral Bay Air Rally — the entry handoff (Node 22, standard library only).
//
// The game itself is plain static files under game/ (game/index.html plus
// its ES modules; nothing loads over the network), and screenshots/ holds
// three real renders of that code in a browser. This program hands both in:
// it copies them beside this file into /output and writes /output/dossier.json,
// the summary the judge reads, using the vendored make.fun library.
//
// Run it locally with MAKEFUN_OUTPUT_DIR set:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play it locally with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');

if (!existsSync(gameDir) || !statSync(gameDir).isDirectory()) {
  throw new Error(`game/ is missing beside main.ts (looked in ${gameDir})`);
}
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('game/index.html is missing — the game has no entrypoint to open');
}
const shots = existsSync(shotsDir) ? readdirSync(shotsDir).filter((f) => !f.startsWith('.')) : [];
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`screenshots/ must hold 3 or 4 images, found ${shots.length}`);
}

// The judge refuses screenshots over 256 KiB, or with the long side over
// 1280 px / the short side under 480 px. Check that here, with a plain
// message naming the bad file, instead of failing after the handoff.
function jpegSize(buf) {
  // Walk JPEG markers to the first Start-Of-Frame segment and read its
  // height/width (big-endian, bytes 5..8 of the segment payload).
  let off = 2;
  while (off + 9 < buf.length) {
    if (buf[off] !== 0xff) throw new Error('not a JPEG stream');
    const marker = buf[off + 1];
    const len = buf.readUInt16BE(off + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: buf.readUInt16BE(off + 7), height: buf.readUInt16BE(off + 5) };
    }
    off += 2 + len;
  }
  throw new Error('no JPEG frame header found');
}
for (const name of shots) {
  const path = join(shotsDir, name);
  const buf = readFileSync(path);
  if (buf.length > 262144) {
    throw new Error(`screenshot ${name} is ${buf.length} bytes — over the 256 KiB cap`);
  }
  if (name.toLowerCase().endsWith('.jpg') || name.toLowerCase().endsWith('.jpeg')) {
    const { width, height } = jpegSize(buf);
    const longSide = Math.max(width, height);
    const shortSide = Math.min(width, height);
    if (longSide > 1280 || shortSide < 480) {
      throw new Error(`screenshot ${name} is ${width}x${height} — long side must be <= 1280 and short side >= 480`);
    }
  }
}

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// Same caps the gate scores against: the dossier text cap shapes the bytes,
// the rest refuse an entry the scorer would refuse, so failing here is
// failing early instead of after the submit.
const dossierPath = join(out, 'dossier.json');
writeFileSync(
  dossierPath,
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`handed in ${shots.length} screenshots and game/ to ${out} (dossier ${statSync(dossierPath).size} bytes)`);

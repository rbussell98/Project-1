// Rebuild public/index/big-int8.bin with the embedder in src/matcher/model.json.
// Uses the release groups already listed in big-meta.json and CAA front-250 thumbs.
// Resumable: covers and vectors land in .cache/rebuild. Inference is serial.
//
//   node matcher/eval/rebuild-index.mjs
import fs from 'node:fs';
import path from 'node:path';
import { loadEmbedder, embedMany, IMAGE_SIZE } from '../src/embed.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const UA = 'Sleeve/1.0 (rbussell98@gmail.com)';
const metaPath = path.join(root, 'public/index/big-meta.json');
const binPath = path.join(root, 'public/index/big-int8.bin');
const modelPath = path.join(root, 'public/index/model.json');
const specPath = path.join(root, 'src/matcher/model.json');
const cache = path.join(root, '.cache/rebuild');
const covers = path.join(cache, 'covers');
const vecDir = path.join(cache, 'vecs');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

fs.mkdirSync(covers, { recursive: true });
fs.mkdirSync(vecDir, { recursive: true });

const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
console.log('release groups', meta.length, 'model', spec.id, spec.dtype, 'image', IMAGE_SIZE);

async function download(rgid) {
  const dest = path.join(covers, `${rgid}.jpg`);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 500) return dest;
  const url = `https://coverartarchive.org/release-group/${rgid}/front-250`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'image/jpeg' }, redirect: 'follow' });
    if (res.status === 404) return null;
    if (res.status === 429 || res.status === 503) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 500) return null;
    fs.writeFileSync(dest, buf);
    return dest;
  }
  return null;
}

let embedChain = Promise.resolve();
function embedFile(file) {
  const run = embedChain.then(() => embedMany([fs.readFileSync(file)]));
  embedChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

await loadEmbedder();
const kept = [];
const t0 = Date.now();
let cursor = 0;
let misses = 0;

async function worker() {
  while (cursor < meta.length) {
    const row = meta[cursor++];
    const [rgid, artist, title] = row;
    const vecPath = path.join(vecDir, `${rgid}.f32`);
    if (!(fs.existsSync(vecPath) && fs.statSync(vecPath).size === spec.dim * 4)) {
      const file = await download(rgid);
      if (!file) {
        misses++;
      } else {
        try {
          const [vec] = await embedFile(file);
          if (vec.length !== spec.dim) throw new Error(`dim ${vec.length} != ${spec.dim}`);
          const copy = Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
          fs.writeFileSync(vecPath, copy);
        } catch (err) {
          misses++;
          console.warn('embed fail', rgid, err instanceof Error ? err.message : err);
        }
      }
    }
    if (fs.existsSync(vecPath) && fs.statSync(vecPath).size === spec.dim * 4) kept.push({ rgid, artist, title });
    const n = kept.length + misses;
    if (n % 200 === 0) {
      console.log(`${kept.length} kept, ${misses} miss, ${meta.length - cursor} left, ${Math.round((Date.now() - t0) / 1000)}s`);
    }
  }
}

await Promise.all(Array.from({ length: 6 }, () => worker()));

const order = new Map(meta.map((row, i) => [row[0], i]));
kept.sort((a, b) => (order.get(a.rgid) ?? 0) - (order.get(b.rgid) ?? 0));

const dim = spec.dim;
const buf = Buffer.alloc(kept.length * dim);
for (let i = 0; i < kept.length; i++) {
  const raw = fs.readFileSync(path.join(vecDir, `${kept[i].rgid}.f32`));
  const v = new Float32Array(raw.buffer, raw.byteOffset, dim);
  for (let d = 0; d < dim; d++) {
    buf.writeInt8(Math.max(-127, Math.min(127, Math.round(v[d] * 127))), i * dim + d);
  }
}
fs.writeFileSync(binPath, buf);
fs.writeFileSync(metaPath, JSON.stringify(kept.map(({ rgid, artist, title }) => [rgid, artist, title])));
fs.writeFileSync(
  modelPath,
  JSON.stringify({ id: spec.id, dtype: spec.dtype, dim, imageSize: spec.imageSize, count: kept.length }, null, 2) + '\n',
);
console.log('wrote', kept.length, 'misses', misses, 'bytes', buf.length, 'in', Math.round((Date.now() - t0) / 1000), 's');

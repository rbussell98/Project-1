import fs from 'node:fs'; import sharp from 'sharp';
import { loadEmbedder, embedMany, dot } from '../src/embed.mjs';
import { loadPhoto } from '../src/imageprep.mjs';
await loadEmbedder();
const ds = JSON.parse(fs.readFileSync('eval/dataset.json'));
const agg = { whole: [], c84: [], c64: [], crop: [] };
for (const lv of ['mild', 'harsh']) for (const d of ds) {
  const p = await loadPhoto(`eval/photos/${d.rgid}_${lv}.jpg`);
  const src = (await embedMany([fs.readFileSync(d.file)]))[0];
  const cr = (x, y, w, h) => sharp(p.buf).extract({ left: Math.round(x * p.width), top: Math.round(y * p.height), width: Math.round(w * p.width), height: Math.round(h * p.height) }).toBuffer();
  const bufs = [p.buf, await cr(.08, .08, .84, .84), await cr(.18, .18, .64, .64)];
  const cf = `eval/crops/${d.rgid}_${lv}.jpg`; const hasCrop = fs.existsSync(cf); if (hasCrop) bufs.push(fs.readFileSync(cf));
  const e = await embedMany(bufs);
  const s = e.map((v) => dot(v, src));
  agg.whole.push(s[0]); agg.c84.push(s[1]); agg.c64.push(s[2]); if (hasCrop) agg.crop.push(s[3]);
  console.log(lv, d.title.slice(0, 20).padEnd(20), s.map((x) => x.toFixed(2)).join(' '));
}
const mean = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(3);
console.log('mean whole', mean(agg.whole), 'c84', mean(agg.c84), 'c64', mean(agg.c64), 'crop', mean(agg.crop), agg.crop.length);

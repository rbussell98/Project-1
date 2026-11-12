import fs from 'node:fs';
import sharp from 'sharp';
import { cropCover } from '../src/cropcover.mjs';
import { loadPhoto } from '../src/imageprep.mjs';
const ds = JSON.parse(fs.readFileSync('eval/dataset.json'));
fs.mkdirSync('eval/crops', { recursive: true });
let ok = 0, n = 0; const tiles = [];
for (const lv of ['mild', 'harsh']) for (const d of ds) {
  const p = await loadPhoto(`eval/photos/${d.rgid}_${lv}.jpg`);
  const t0 = Date.now(); const r = await cropCover(p.buf); n++;
  if (r) ok++;
  console.log(lv, d.title.slice(0, 22).padEnd(22), r ? `found area=${r.areaFrac.toFixed(2)} ${Date.now() - t0}ms` : 'NOT FOUND');
  if (r) fs.writeFileSync(`eval/crops/${d.rgid}_${lv}.jpg`, r.buf);
}
console.log('found', ok, '/', n);

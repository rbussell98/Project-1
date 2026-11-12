// Collect RAW OCR lines for every photo, for crop and whole-photo sources, for offline ablation.
import fs from 'node:fs'; import crypto from 'node:crypto';
import { loadPhoto } from '../src/imageprep.mjs';
import { cropCover } from '../src/cropcover.mjs';
import { makeOcr, buildJobs } from '../src/ocr.mjs';
const ds = JSON.parse(fs.readFileSync('eval/dataset.json'));
const items = [];
for (const lv of ['mild', 'harsh']) for (const d of ds) items.push({ id: `${d.rgid}_${lv}`, file: `eval/photos/${d.rgid}_${lv}.jpg`, d });
items.push({ id: 'real_moonlight', file: 'eval/real/jj_moonlight_screenshot.jpg' }, { id: 'real_ibd', file: '/workspace/sleeve-review/jj-cover.jpg' });
fs.mkdirSync('cache/rawocr', { recursive: true });
const ocr = await makeOcr(4);
for (const it of items) {
  const f = `cache/rawocr/${it.id}.json`; if (fs.existsSync(f)) continue;
  const t0 = Date.now();
  const p = await loadPhoto(it.file); const cover = await cropCover(p.buf, { out: 1024 }).catch(() => null);
  const out = { crop: null, whole: null, times: {} };
  if (cover) { const t = Date.now(); out.crop = await ocr.run(await buildJobs(cover.buf, 'full')); out.times.crop = Date.now() - t; }
  { const t = Date.now(); out.whole = await ocr.run(await buildJobs(p.buf, 'full')); out.times.whole = Date.now() - t; }
  fs.writeFileSync(f, JSON.stringify(out));
  console.log(it.id.slice(0, 8), Date.now() - t0, 'ms');
}
await ocr.close();

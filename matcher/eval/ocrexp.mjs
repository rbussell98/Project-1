import fs from 'node:fs'; import sharp from 'sharp';
import { PSM } from 'tesseract.js';
import { loadPhoto, adaptiveBinarize, cropFrac } from '../src/imageprep.mjs';
import { cropCover } from '../src/cropcover.mjs';
import { makeOcr, goodLines } from '../src/ocr.mjs';
import { ocrWordSet, textScore } from '../src/textmatch.mjs';
const ds = JSON.parse(fs.readFileSync('eval/dataset.json'));
const lv = process.argv[2] || 'mild';
const ocr = await makeOcr(6);
const configs = {
  base: { width: 1800, regions: ['whole', 'top', 'bottom'], adapt: [[25, 12], [50, 8]], pols: ['dark', 'bright'] },
  w2600: { width: 2600, regions: ['whole', 'top', 'bottom'], adapt: [[35, 12], [70, 8]], pols: ['dark', 'bright'] },
  w1200: { width: 1200, regions: ['whole', 'top', 'bottom'], adapt: [[17, 12], [35, 8]], pols: ['dark', 'bright'] },
  lowoff: { width: 1800, regions: ['whole', 'top', 'bottom'], adapt: [[25, 6], [50, 4]], pols: ['dark', 'bright'] },
  more: { width: 1800, regions: ['whole', 'top', 'bottom', 'mid'], adapt: [[15, 10], [25, 12], [50, 8]], pols: ['dark', 'bright'] },
};
const res = {}; const timeBy = {};
const items = ds.map((d) => ({ d, file: `eval/photos/${d.rgid}_${lv}.jpg` }));
const covers = [];
for (const it of items) { const p = await loadPhoto(it.file); const c = await cropCover(p.buf, { out: 1024 }); covers.push(c?.buf || p.buf); }
for (const [name, cfg] of Object.entries(configs)) {
  let any = 0, both = 0, art = 0; const t0 = Date.now();
  for (let i = 0; i < items.length; i++) {
    const R = { whole: [0, 0, 1, 1], top: [0, 0, 1, 0.5], bottom: [0, 0.5, 1, 0.5], mid: [0, 0.25, 1, 0.5] };
    const jobs = [];
    for (const rg of cfg.regions) {
      let base = rg === 'whole' ? covers[i] : await cropFrac(covers[i], ...R[rg]);
      base = await sharp(base).resize({ width: cfg.width }).toBuffer();
      for (const pol of cfg.pols) for (const [s, o] of cfg.adapt) jobs.push({ img: await adaptiveBinarize(base, s, o, pol), psm: PSM.SPARSE_TEXT, tag: `${rg}/${pol}/s${s}/psm11` });
    }
    const g = goodLines(await ocr.run(jobs)).slice(0, 8);
    const s = textScore({ artist: items[i].d.mbArtist, title: items[i].d.mbTitle }, ocrWordSet(g));
    if (s.artist >= 0.75 || s.title >= 0.75) any++; if (s.artist >= 0.75 && s.title >= 0.75) both++; if (s.artist >= .75) art++;
  }
  console.log(name.padEnd(8), `any ${any}/30 artist ${art} both ${both}  ${Math.round((Date.now() - t0) / 30)} ms/photo (6 workers)`);
}
await ocr.close();

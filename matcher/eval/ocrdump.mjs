import fs from 'node:fs';
import { loadPhoto } from '../src/imageprep.mjs';
import { makeOcr, buildJobs, goodLines } from '../src/ocr.mjs';
const ds = JSON.parse(fs.readFileSync(new URL('./dataset.json', import.meta.url)));
const files = process.argv.slice(2);
const ocr = await makeOcr(3);
for (const f of files) {
  const t0 = Date.now();
  const p = await loadPhoto(f);
  const jobs = await buildJobs(p.buf, 'full');
  const lines = await ocr.run(jobs);
  const good = goodLines(lines).slice(0, 6);
  console.log(f.split('/').pop(), jobs.length, 'passes', Date.now() - t0, 'ms ::', good.map((g) => `${g.text}[${Math.round(g.score)}]`).join(' | '));
}
await ocr.close();

import { createWorker, PSM } from 'tesseract.js';
import { loadPhoto, adaptiveBinarize, plainGrey, cropFrac } from './imageprep.mjs';

export async function makeOcr(n = 2) {
  const workers = [];
  for (let i = 0; i < n; i++) workers.push(await createWorker('eng', 1, { logger: () => {}, errorHandler: () => {} }));
  return {
    workers,
    async run(jobs) { // jobs: [{img, psm, tag}]
      const out = []; let next = 0;
      await Promise.all(workers.map(async (w) => {
        let cur = -1;
        while (next < jobs.length) {
          const j = jobs[next++];
          if (j.psm !== cur) { await w.setParameters({ tessedit_pageseg_mode: j.psm, user_defined_dpi: '300' }); cur = j.psm; }
          try {
            const { data } = await w.recognize(j.img, {}, { blocks: true });
            const lines = [];
            for (const b of data.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || [])
              lines.push({ text: l.text.trim(), conf: l.confidence, words: (l.words || []).map((x) => ({ t: x.text, c: x.confidence })), tag: j.tag });
            out.push(...lines);
          } catch (e) { /* ignore a bad pass */ }
        }
      }));
      return out;
    },
    async close() { await Promise.all(workers.map((w) => w.terminate())); },
  };
}

// Build the multi-pass job list. Ablation on 60 degraded photos showed: adaptive (local-contrast) binarisation in both
// polarities + sparse-text PSM carries nearly all the signal; plain greyscale and PSM 3 add almost nothing.
//  'standard' = 12 passes (whole/top/bottom x dark/bright x 2 blur radii), 'thorough' = 24 passes.
export async function buildJobs(photoBuf, profile = 'standard', only = null) {
  const sharp = (await import('sharp')).default;
  const thorough = profile === 'thorough' || profile === 'full';
  const regions = thorough ? [['whole', 0, 0, 1, 1], ['top', 0, 0, 1, 0.5], ['bottom', 0, 0.5, 1, 0.5], ['mid', 0, 0.25, 1, 0.5]] : [['whole', 0, 0, 1, 1], ['top', 0, 0, 1, 0.5], ['bottom', 0, 0.5, 1, 0.5]];
  const sel = only ? regions.filter((r) => only.includes(r[0])) : regions;
  const adapt = thorough ? [[15, 10], [25, 12], [50, 8]] : [[25, 12], [50, 8]];
  const jobs = [];
  for (const [name, x, y, w, h] of sel) {
    let base = name === 'whole' ? photoBuf : await cropFrac(photoBuf, x, y, w, h);
    base = await sharp(base).resize({ width: 1800 }).toBuffer();
    for (const pol of ['dark', 'bright']) for (const [sigma, off] of adapt)
      jobs.push({ img: await adaptiveBinarize(base, sigma, off, pol), psm: PSM.SPARSE_TEXT, tag: `${name}/${pol}/s${sigma}/psm${PSM.SPARSE_TEXT}` });
  }
  return jobs;
}

export { cleanLine, goodLines, STOP } from './ocrtext.mjs';

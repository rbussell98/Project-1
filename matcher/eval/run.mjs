// usage: node eval/run.mjs <level|real> [outfile]
import fs from 'node:fs';
import { createMatcher } from '../src/pipeline.mjs';
import { stats } from '../src/net.mjs';
const level = process.argv[2] || 'mild';
const outFile = process.argv[3] || `eval/results_${level}_${process.env.RUN_TAG || 'full'}.json`;
const ds = JSON.parse(fs.readFileSync('eval/dataset.json'));
let items;
if (level === 'real') items = [
  { file: new URL('../../eval/real/jj_moonlight_screenshot.jpg', import.meta.url).pathname, rgid: '3d88aa7d-fb1c-433f-9df6-e3d294671304', artist: 'Jack Johnson', title: 'Meet the Moonlight', style: 'real-screenshot' },
].filter((it) => fs.existsSync(it.file));
else items = ds.map((d) => ({ ...d, file: `eval/photos/${d.rgid}_${level}.jpg` }));
const tag = process.env.RUN_TAG || 'full';
const excl = process.env.EXCLUDE_TESTSET ? [...ds.map((d) => d.rgid), '3d88aa7d-fb1c-433f-9df6-e3d294671304', '20151063-d6d9-3131-91ac-5c4a7a0f5f01'] : [];
const m = await createMatcher({ ocrCacheDir: 'cache/ocr_' + tag, excludeFromIndex: excl, useIndex: !process.env.NOINDEX });
const results = [];
for (const it of items) {
  let r;
  try { r = await m.identify(it.file, { log: () => {} }); } catch (e) { r = { error: e.message, ranked: [] }; }
  const idx = r.ranked.findIndex((x) => x.rgid === it.rgid);
  const res = { artist: it.artist, title: it.title, style: it.style, altEdition: it.differentEdition, rank: idx + 1, truthInCandidates: undefined, top: r.ranked.slice(0, 3).map((x) => `${x.artist} - ${x.title} (${x.sim.toFixed(3)})`), phrases: (r.phrases || []).slice(0, 3).map((p) => p.text), nCand: r.nCandidates, nArt: r.nWithArt, timing: r.timing, fast: r.fast, stageB: r.usedStageB, mbQ: r.mbQueries, confident: r.confident, barcode: r.barcode, err: r.error, simTop: r.ranked[0]?.sim, simTruth: idx >= 0 ? r.ranked[idx].sim : null, simSecond: r.ranked[1]?.sim };
  results.push(res);
  console.log(`${idx === 0 ? 'TOP1' : idx > 0 && idx < 3 ? 'TOP3' : idx > 0 ? `r${idx + 1}` : 'MISS'}  ${it.artist} - ${it.title} | ocr: ${res.phrases.join(' / ')} | cand ${res.nCand}/${res.nArt} | ${res.timing?.done}ms ${res.err || ''}`);
}
fs.writeFileSync(outFile, JSON.stringify(results, null, 1));
const n = results.length, t1 = results.filter((r) => r.rank === 1).length, t3 = results.filter((r) => r.rank >= 1 && r.rank <= 3).length;
console.log(`\n${level}: top1 ${t1}/${n} (${(100 * t1 / n).toFixed(0)}%)  top3 ${t3}/${n} (${(100 * t3 / n).toFixed(0)}%)  MB reqs ${stats.mbRequests} cache hits ${stats.mbCacheHits}`);
await m.close();

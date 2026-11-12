import fs from 'node:fs'; import sharp from 'sharp';
import { loadEmbedder, embedMany } from '../src/embed.mjs';
import { loadPopularIndex } from '../src/popindex.mjs';
import { loadPhoto } from '../src/imageprep.mjs';
import { cropCover } from '../src/cropcover.mjs';
await loadEmbedder();
const idx = loadPopularIndex();
const ds = JSON.parse(fs.readFileSync('eval/dataset.json'));
const inIdx = new Set(idx.meta.map((m) => m[0]));
console.log('test albums in popular index:', ds.filter((d) => inIdx.has(d.rgid)).length, '/', ds.length, ds.filter((d) => !inIdx.has(d.rgid)).map((d) => d.title).join('; '));
const rows = [];
for (const lv of ['mild', 'harsh']) for (const d of ds) {
  const p = await loadPhoto(`eval/photos/${d.rgid}_${lv}.jpg`);
  const cov = await cropCover(p.buf, { out: 1024 }).catch(() => null);
  const embs = await embedMany([...(cov ? [cov.buf] : []), p.buf]);
  let best = [];
  for (const e of embs) best = best.concat(idx.search(e, 5));
  const m = new Map(); for (const b of best) if (!m.has(b.rgid) || m.get(b.rgid).sim < b.sim) m.set(b.rgid, b);
  const top = [...m.values()].sort((a, b) => b.sim - a.sim);
  const rank = top.findIndex((t) => t.rgid === d.rgid) + 1;
  rows.push({ lv, t: d.title, inIdx: inIdx.has(d.rgid), rank, sim: top[0].sim, top1: top[0].title, truthSim: rank ? top[rank - 1].sim : null });
}
for (const r of rows.filter((r) => r.inIdx)) console.log(r.lv, r.t.slice(0, 24).padEnd(24), 'rank', r.rank || '-', 'top1sim', r.sim.toFixed(3), r.rank === 1 ? '' : '(got ' + r.top1 + ')');
const inr = rows.filter((r) => r.inIdx);
console.log('in-index photos:', inr.length, 'top1', inr.filter((r) => r.rank === 1).length, 'top3', inr.filter((r) => r.rank && r.rank <= 3).length);
console.log('wrong-top1 sims:', inr.filter((r) => r.rank !== 1).map((r) => r.sim.toFixed(2)).join(','), ' right-top1 sims min:', Math.min(...inr.filter((r) => r.rank === 1).map((r) => r.sim)).toFixed(3));
console.log('NOT in index, top1 sims (false positives):', rows.filter((r) => !r.inIdx).map((r) => r.sim.toFixed(2)).join(','));

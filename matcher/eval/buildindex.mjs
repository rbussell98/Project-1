// Offline build of the "popular albums" visual index from ListenBrainz public sitewide stats (no token needed).
import fs from 'node:fs';
import { caaFetch, UA, sleep } from '../src/net.mjs';
import { loadEmbedder, embedMany } from '../src/embed.mjs';
const ranges = ['all_time', 'year', 'this_year', 'half_yearly', 'quarter', 'month', 'this_month', 'week', 'this_week'];
const items = new Map();
for (const range of ranges) for (let off = 0; off < 1000; off += 100) {
  const r = await fetch(`https://api.listenbrainz.org/1/stats/sitewide/release-groups?range=${range}&count=100&offset=${off}`, { headers: { 'User-Agent': UA } });
  if (!r.ok) { console.log(range, off, r.status); break; }
  const j = await r.json(); const rgs = j.payload?.release_groups || [];
  for (const x of rgs) if (x.caa_id && x.caa_release_mbid && !items.has(x.release_group_mbid)) items.set(x.release_group_mbid, { rgid: x.release_group_mbid, title: x.release_group_name, artist: x.artist_name, url: `https://coverartarchive.org/release/${x.caa_release_mbid}/${x.caa_id}-250.jpg`, rank: items.size });
  if (rgs.length < 100) break;
  await sleep(300);
}
console.log('unique release groups', items.size);
await loadEmbedder();
const list = [...items.values()]; const kept = []; const vecs = [];
let i = 0;
const t0 = Date.now();
async function worker() {
  while (i < list.length) {
    const it = list[i++];
    const b = await caaFetch(it.url); if (!b) continue;
    try { const [e] = await embedMany([b]); kept.push(it); vecs.push(e); } catch {}
    if (kept.length % 200 === 0) console.log(kept.length, Math.round((Date.now() - t0) / 1000) + 's');
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
const dim = 512; const buf = Buffer.alloc(kept.length * dim);
vecs.forEach((v, k) => { for (let d = 0; d < dim; d++) buf.writeInt8(Math.max(-127, Math.min(127, Math.round(v[d] * 127))), k * dim + d); });
fs.mkdirSync('index', { recursive: true });
fs.writeFileSync('index/popular-int8.bin', buf);
fs.writeFileSync('index/popular-meta.json', JSON.stringify(kept.map(({ rgid, title, artist }) => [rgid, artist, title])));
console.log('index size', kept.length, buf.length, 'bytes');

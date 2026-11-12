// Extend the popular index: top ListenBrainz artists -> MusicBrainz albums (1 req/s) -> CAA 250px -> CLIP int8.
import fs from 'node:fs';
import { mbJson, caaFetch, UA, sleep } from '../src/net.mjs';
import { loadEmbedder, embedMany } from '../src/embed.mjs';
const NART = Number(process.argv[2] || 800);
const oldMeta = JSON.parse(fs.readFileSync('index/popular-meta.json'));
const oldBin = fs.readFileSync('index/popular-int8.bin');
const D = 512;
const meta = oldMeta.slice(); const vecs = []; // Int8Array rows
for (let i = 0; i < oldMeta.length; i++) vecs.push(new Int8Array(oldBin.buffer, oldBin.byteOffset + i * D, D).slice());
const have = new Set(meta.map((m) => m[0]));
await loadEmbedder();
// artists
const artists = [];
for (let off = 0; off < NART; off += 100) {
  const r = await fetch(`https://api.listenbrainz.org/1/stats/sitewide/artists?range=all_time&count=100&offset=${off}`, { headers: { 'User-Agent': UA } });
  const j = await r.json(); artists.push(...(j.payload?.artists || []));
}
console.log('artists', artists.length);
const queue = []; let producing = true; let done = 0;
const save = () => {
  const buf = Buffer.alloc(vecs.length * D); vecs.forEach((v, i) => buf.set(Buffer.from(v.buffer, v.byteOffset, D), i * D));
  fs.writeFileSync('index/big-int8.bin', buf); fs.writeFileSync('index/big-meta.json', JSON.stringify(meta));
};
async function consumer() {
  while (producing || queue.length) {
    const it = queue.shift(); if (!it) { await sleep(200); continue; }
    const b = await caaFetch(`https://coverartarchive.org/release-group/${it[0]}/front-250`);
    done++;
    if (!b) continue;
    try { const [e] = await embedMany([b]); const q = new Int8Array(D); for (let d = 0; d < D; d++) q[d] = Math.max(-127, Math.min(127, Math.round(e[d] * 127))); meta.push(it); vecs.push(q); } catch {}
    if (meta.length % 500 === 0) { save(); console.log('indexed', meta.length, 'queue', queue.length); }
  }
}
const workers = Array.from({ length: 16 }, consumer);
const Q = ' AND primarytype:album AND -secondarytype:compilation AND -secondarytype:remix AND -secondarytype:dj-mix AND -secondarytype:mixtape/street AND -secondarytype:demo AND -secondarytype:spokenword';
let a = 0;
for (const ar of artists) {
  a++;
  try {
    const j = await mbJson(`https://musicbrainz.org/ws/2/release-group?query=${encodeURIComponent('arid:' + ar.artist_mbid + Q)}&limit=60&fmt=json`);
    for (const rg of j?.['release-groups'] || []) if (!have.has(rg.id)) { have.add(rg.id); queue.push([rg.id, (rg['artist-credit'] || []).map((x) => (x.name || '') + (x.joinphrase || '')).join(''), rg.title]); }
  } catch (e) { console.log('artist fail', ar.artist_name, e.message); }
  if (a % 50 === 0) console.log('artists', a, 'queued', have.size, 'embedded', meta.length);
}
producing = false;
await Promise.all(workers);
save();
console.log('FINAL index', meta.length);

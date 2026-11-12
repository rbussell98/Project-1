// Polite, cached, serial HTTP client. MusicBrainz: strictly serial, >=1.1s between requests,
// one retry after 3s on 503. Cover Art Archive: small concurrency, cached.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const UA = 'Sleeve/1.0 (rbussell98@gmail.com)';
const CACHE = process.env.SLEEVE_CACHE || path.resolve(new URL('..', import.meta.url).pathname, 'cache');
fs.mkdirSync(CACHE, { recursive: true });
export const stats = { mbRequests: 0, mbCacheHits: 0, caaRequests: 0, caaCacheHits: 0, mbWaitMs: 0 };
const key = (u) => crypto.createHash('sha1').update(u).digest('hex');
let lastMb = 0;
let mbChain = Promise.resolve();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function mbJson(url) {
  const f = path.join(CACHE, 'mb_' + key(url) + '.json');
  if (fs.existsSync(f)) { stats.mbCacheHits++; return Promise.resolve(JSON.parse(fs.readFileSync(f, 'utf8'))); }
  // serialise through a promise chain => one request at a time
  const run = async () => {
    const MAXR = Number(process.env.SLEEVE_MB_RETRIES ?? 1);
    for (let attempt = 0; attempt <= MAXR; attempt++) {
      const wait = Math.max(0, lastMb + 1100 - Date.now());
      if (wait) { stats.mbWaitMs += wait; await sleep(wait); }
      lastMb = Date.now(); stats.mbRequests++; // spacing is measured between request STARTS
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
      if (r.status === 503 && attempt < MAXR) { await sleep(3000 * (attempt + 1)); continue; }
      if (r.status === 404) return null;
      if (r.status === 503) throw new Error('MusicBrainz busy (503)');
      if (!r.ok) throw new Error('MusicBrainz HTTP ' + r.status);
      const j = await r.json();
      fs.writeFileSync(f, JSON.stringify(j));
      return j;
    }
    throw new Error('MusicBrainz busy (503)');
  };
  const p = mbChain.then(run, run);
  mbChain = p.catch(() => {});
  return p;
}

// returns Buffer or null (404/no art)
export async function caaFetch(url) {
  const f = path.join(CACHE, 'caa_' + key(url) + '.bin');
  const miss = f + '.404';
  if (fs.existsSync(f)) { stats.caaCacheHits++; return fs.readFileSync(f); }
  if (fs.existsSync(miss)) { stats.caaCacheHits++; return null; }
  stats.caaRequests++;
  for (let a = 0; a < 2; a++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(15000) });
      if (r.status === 404) { fs.writeFileSync(miss, ''); return null; }
      if (!r.ok) { if (a === 0) { await sleep(1500); continue; } return null; }
      const b = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(f, b); return b;
    } catch (e) { if (a === 1) return null; await sleep(1000); }
  }
  return null;
}
export { UA, sleep };

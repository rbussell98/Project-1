import fs from 'node:fs';
export function loadPopularIndex(name = process.env.SLEEVE_INDEX || 'big', exclude = new Set(), dir = new URL('../../public/index/', import.meta.url).pathname) {
  const meta = JSON.parse(fs.readFileSync(`${dir}${name}-meta.json`));
  const bin = fs.readFileSync(`${dir}${name}-int8.bin`);
  const n = meta.length, d = 512; const vec = new Int8Array(bin.buffer, bin.byteOffset, n * d);
  const by = new Map(meta.map((m, i) => [m[0], i]));
  return {
    n, meta, has: (id) => by.has(id) && !exclude.has(id), idxOf: (id) => by.get(id),
    vec(i) { const o = new Float32Array(d); let n = 0; for (let j = 0; j < d; j++) { o[j] = vec[i * d + j]; n += o[j] * o[j]; } n = Math.sqrt(n) || 1; for (let j = 0; j < d; j++) o[j] /= n; return o; },
    search(q, k = 5) { // q: unit Float32Array(512); int8 = round(v*127) so dot/127 ~= cosine
      const out = [];
      for (let i = 0; i < n; i++) { if (exclude.size && exclude.has(meta[i][0])) continue; let s = 0; const o = i * d; for (let j = 0; j < d; j++) s += vec[o + j] * q[j]; out.push([s / 127, i]); }
      out.sort((a, b) => b[0] - a[0]);
      return out.slice(0, k).map(([sim, i]) => ({ i, rgid: meta[i][0], artist: meta[i][1], title: meta[i][2], sim }));
    },
  };
}

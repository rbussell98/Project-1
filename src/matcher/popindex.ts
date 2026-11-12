export interface IndexHit {
  i: number;
  rgid: string;
  artist: string;
  title: string;
  sim: number;
}

export interface PopularIndex {
  n: number;
  search: (q: Float32Array, k?: number) => IndexHit[];
  has: (id: string) => boolean;
  vec: (i: number) => Float32Array;
  idxOf: (id: string) => number | undefined;
}

type MetaRow = [string, string, string];

export function openIndex(meta: MetaRow[], bin: ArrayBuffer): PopularIndex {
  const d = 512;
  const vecs = new Int8Array(bin);
  const n = Math.min(meta.length, Math.floor(vecs.length / d));
  const by = new Map<string, number>();
  for (let i = 0; i < n; i++) by.set(meta[i][0], i);
  return {
    n,
    has: (id) => by.has(id),
    idxOf: (id) => by.get(id),
    vec(i: number) {
      const o = new Float32Array(d);
      let norm = 0;
      const base = i * d;
      for (let j = 0; j < d; j++) {
        o[j] = vecs[base + j];
        norm += o[j] * o[j];
      }
      norm = Math.sqrt(norm) || 1;
      for (let j = 0; j < d; j++) o[j] /= norm;
      return o;
    },
    search(q, k = 8) {
      const out: [number, number][] = [];
      for (let i = 0; i < n; i++) {
        let s = 0;
        const o = i * d;
        for (let j = 0; j < d; j++) s += vecs[o + j] * q[j];
        out.push([s / 127, i]);
      }
      out.sort((a, b) => b[0] - a[0]);
      return out.slice(0, k).map(([sim, i]) => ({
        i,
        rgid: meta[i][0],
        artist: meta[i][1],
        title: meta[i][2],
        sim,
      }));
    },
  };
}

export function dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

export function l2(v: ArrayLike<number>): Float32Array {
  const o = new Float32Array(v.length);
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  s = Math.sqrt(s) || 1;
  for (let i = 0; i < v.length; i++) o[i] = v[i] / s;
  return o;
}

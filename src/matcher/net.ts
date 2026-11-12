import { artGet, artSet, cacheGet, cacheSet } from '../db';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function mbBase(): string {
  return import.meta.env.DEV ? '/mb' : 'https://musicbrainz.org';
}

export function caaBase(): string {
  return import.meta.env.DEV ? '/caa' : 'https://coverartarchive.org';
}

let lastMb = 0;
let mbChain: Promise<unknown> = Promise.resolve();
const inflight = new Map<string, Promise<unknown>>();

export async function mbJson(url: string): Promise<Record<string, unknown> | null> {
  const hit = await cacheGet(url);
  if (hit) {
    try {
      return JSON.parse(hit) as Record<string, unknown>;
    } catch {
      /* refetch */
    }
  }
  const existing = inflight.get(url);
  if (existing) return existing as Promise<Record<string, unknown> | null>;

  const run = async () => {
    const maxR = 1;
    for (let attempt = 0; attempt <= maxR; attempt++) {
      const wait = Math.max(0, lastMb + 1100 - Date.now());
      if (wait) await sleep(wait);
      lastMb = Date.now();
      const r = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(20000),
      });
      if (r.status === 503 && attempt < maxR) {
        await sleep(3000 * (attempt + 1));
        continue;
      }
      if (r.status === 404) return null;
      if (r.status === 503) throw new Error('MusicBrainz busy (503)');
      if (!r.ok) throw new Error('MusicBrainz HTTP ' + r.status);
      const j = (await r.json()) as Record<string, unknown>;
      await cacheSet(url, JSON.stringify(j));
      return j;
    }
    throw new Error('MusicBrainz busy (503)');
  };

  const p = mbChain.then(run, run);
  mbChain = p.then(
    () => undefined,
    () => undefined,
  );
  inflight.set(url, p);
  try {
    return await p;
  } finally {
    inflight.delete(url);
  }
}

export async function caaFetchBlob(url: string): Promise<Blob | null> {
  const cached = await artGet(url);
  if (cached !== undefined) return cached;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (r.status === 404 || !r.ok) {
      await artSet(url, null);
      return null;
    }
    const blob = await r.blob();
    await artSet(url, blob);
    return blob;
  } catch {
    return null;
  }
}

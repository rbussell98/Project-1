// Same numbers as matcher/src/rank.mjs. Tests lock the two together.
export const FAST_SIM = 0.9;
export const FAST_MARGIN = 0.06;
export const TEXT_WEIGHT = 0.15;
export const CONF_SIM = 0.8;
export const CONF_MARGIN = 0.04;
export const INDEX_K = 8;

export interface SimHit {
  sim: number;
  score?: number;
}

export function fastAccept(a?: SimHit, b?: SimHit, fast: boolean = true): boolean {
  if (!fast) return false;
  return !!(a && a.sim >= FAST_SIM && (!b || a.sim - b.sim >= FAST_MARGIN));
}

export function blend(sim: number, text: number, w = TEXT_WEIGHT): number {
  return sim + w * text;
}

export function isConfident(ranked: SimHit[]): boolean {
  return ranked.length >= 1 && ranked[0].sim >= CONF_SIM && (ranked.length < 2 || (ranked[0].score ?? 0) - (ranked[1].score ?? 0) >= CONF_MARGIN);
}

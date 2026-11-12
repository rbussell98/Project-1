// Ranking thresholds from the measured pipeline. Do not tune without re-running eval.
export const FAST_SIM = 0.90;
export const FAST_MARGIN = 0.06;
export const TEXT_WEIGHT = 0.15;
export const CONF_SIM = 0.80;
export const CONF_MARGIN = 0.04;
export const INDEX_K = 8;

export function fastAccept(a, b, C = {}) {
  if (C.fast === false) return false;
  const sim = C.fastSim ?? FAST_SIM;
  const margin = C.fastMargin ?? FAST_MARGIN;
  return !!(a && a.sim >= sim && (!b || a.sim - b.sim >= margin));
}

export function blend(sim, text, w = TEXT_WEIGHT) {
  return sim + w * text;
}

export function isConfident(ranked, C = {}) {
  const sim = C.confSim ?? CONF_SIM;
  const margin = C.confMargin ?? CONF_MARGIN;
  return ranked.length >= 1 && ranked[0].sim >= sim && (ranked.length < 2 || ranked[0].score - ranked[1].score >= margin);
}

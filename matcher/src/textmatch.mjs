// Local fuzzy text scoring of a candidate (artist + title) against what OCR saw.
const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'in', 'to', 'for', 'on', 'at', 'by', 'with', 'is', 'it']);
export const words = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length, n = b.length; let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) { const cur = [i]; let best = i; for (let j = 1; j <= n; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); best = Math.min(best, cur[j]); } if (best > max) return max + 1; prev = cur; }
  return prev[n];
}
export function tokenMatch(w, ocrWords) {
  const maxE = w.length >= 8 ? 2 : w.length >= 4 ? 1 : 0;
  for (const o of ocrWords) {
    if (o === w) return 1;
    if (maxE && lev(o, w, maxE) <= maxE) return 0.85;
    // partial reads like "oyage" for "voyage" / "tween" for "between": long suffix/prefix of the word
    if (w.length >= 6 && o.length >= 4 && (w.endsWith(o) || w.startsWith(o))) return 0.6;
  }
  return 0;
}
export function ocrWordSet(phrases) {
  const s = new Set();
  for (const p of phrases) for (const w of words(p.text)) if (w.length >= 2) s.add(w);
  return [...s];
}
// returns {artist, title, total}: fraction (char-weighted) of tokens found in OCR
export function textScore(cand, ocrWords) {
  const f = (name) => {
    let ws = words(name); const nz = ws.filter((w) => !STOP.has(w)); if (nz.length) ws = nz;
    let tot = 0, got = 0; for (const w of ws) { const wt = Math.max(1, w.length); tot += wt; got += wt * tokenMatch(w, ocrWords); }
    return tot ? got / tot : 0;
  };
  const a = f(cand.artist), t = f(cand.title);
  const total = (a + t) / 2;
  return { artist: a, title: t, total, both: Math.min(a, t) };
}

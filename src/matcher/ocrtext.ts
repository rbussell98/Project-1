const STOP = new Set(['the', 'and', 'of', 'a', 'in', 'to', 'for', 'with', 'by', 'on', 'at', 'an']);

export function cleanLine(t: string): string {
  return t.replace(/[^A-Za-z0-9'&\- ]+/g, ' ').replace(/\s+/g, ' ').replace(/(^| )[-']+( |$)/g, ' ').trim();
}

export interface OcrLine {
  text: string;
  conf: number;
  tag?: string;
}

export interface GoodLine {
  text: string;
  key: string;
  count: number;
  conf: number;
  score: number;
}

export function goodLines(lines: OcrLine[]): GoodLine[] {
  const map = new Map<string, { text: string; key: string; count: number; conf: number; tags: Set<string> }>();
  for (const l of lines) {
    const raw = l.text;
    if (!raw) continue;
    const letters = (raw.match(/[A-Za-z]/g) || []).length;
    if (letters < 4 || letters / raw.replace(/\s/g, '').length < 0.75) continue;
    const c = cleanLine(raw);
    const ws = c.split(' ').filter(Boolean);
    const keep = ws.filter((w) => w.length >= 2 || /^[aiAI]$/.test(w));
    if (keep.length === 0 || keep.length < ws.length * 0.75) continue;
    const alpha = keep.filter((w) => /[A-Za-z]{3,}/.test(w));
    if (alpha.length === 0) continue;
    if (!keep.every((w) => /[aeiouyAEIOUY0-9]/.test(w) || w.length <= 2)) continue;
    if (l.conf < 60) continue;
    const key = keep.join(' ').toLowerCase();
    const e = map.get(key) || { text: keep.join(' '), key, count: 0, conf: 0, tags: new Set<string>() };
    e.count++;
    e.conf = Math.max(e.conf, l.conf);
    e.tags.add((l.tag || 'whole').split('/')[0]);
    map.set(key, e);
  }
  const arr: GoodLine[] = [...map.values()].map((e) => ({
    text: e.text,
    key: e.key,
    count: e.count,
    conf: e.conf,
    score: e.conf * (1 + Math.log2(e.count)) * Math.min(1, 0.4 + e.key.length / 14),
  }));
  arr.sort((a, b) => b.score - a.score);
  return arr;
}

export { STOP };

import { mbJson, mbBase } from './net';
import { ocrWordSet, textScore } from './textmatch';

const TYPE = ' AND (primarytype:album OR primarytype:ep)';
const STUDIO =
  ' AND primarytype:album AND -secondarytype:compilation AND -secondarytype:remix AND -secondarytype:dj-mix AND -secondarytype:mixtape/street';

const esc = (s: string) =>
  s
    .replace(/["\\]/g, ' ')
    .replace(/[+\-&|!(){}[\]^~*?:/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export interface MbCand {
  rgid: string;
  title: string;
  artist: string;
  artistId?: string;
  mbScore: number;
  src: string;
  textScore?: number;
  ts?: ReturnType<typeof textScore>;
}

type Rg = {
  id: string;
  title?: string;
  score?: number;
  'artist-credit'?: { name?: string; joinphrase?: string; artist?: { id?: string } }[];
};

const acName = (rg: Rg) => (rg['artist-credit'] || []).map((a) => (a.name || '') + (a.joinphrase || '')).join('');
const acId = (rg: Rg) => (rg['artist-credit'] || [])[0]?.artist?.id;

const toCand = (rg: Rg, src: string): MbCand => ({
  rgid: rg.id,
  title: rg.title || '',
  artist: acName(rg),
  artistId: acId(rg),
  mbScore: rg.score ?? 0,
  src,
});

async function search(q: string, limit = 100): Promise<Rg[]> {
  const j = await mbJson(`${mbBase()}/ws/2/release-group?query=${encodeURIComponent(q)}&limit=${limit}&fmt=json`);
  return ((j?.['release-groups'] as Rg[]) || []);
}

export class CandidatePool {
  phrases: { text: string; score?: number }[];
  ocrWords: string[];
  log: (...args: unknown[]) => void;
  map = new Map<string, MbCand>();
  used = 0;
  expanded = new Set<string>();
  tried = new Set<string>();
  usedB = false;

  constructor(phrases: { text: string; score?: number }[], log: (...args: unknown[]) => void = () => {}) {
    this.phrases = phrases;
    this.ocrWords = ocrWordSet(phrases);
    this.log = log;
  }

  add(c: MbCand) {
    const e = this.map.get(c.rgid);
    if (!e) this.map.set(c.rgid, { ...c });
    else e.mbScore = Math.max(e.mbScore, c.mbScore);
  }

  async q(query: string, tag: string) {
    if (this.tried.has(query)) return [] as Rg[];
    this.tried.add(query);
    this.used++;
    this.log('MB', tag, query);
    const rgs = await search(query);
    for (const rg of rgs) this.add(toCand(rg, tag));
    return rgs;
  }

  async stageA() {
    const P = this.phrases
      .slice(0, 5)
      .map((p) => esc(p.text))
      .filter((t) => t.length >= 3);
    if (!P.length) return;
    const clauses = P.flatMap((p) => [`artist:"${p}"`, `releasegroup:"${p}"`]);
    await this.q(`(${clauses.join(' OR ')})${TYPE}`, 'combined');
    const frag = [...new Set(P.slice(0, 4).flatMap((p) => p.toLowerCase().split(' ')).filter((w) => w.length >= 4))].slice(0, 4);
    if (frag.length >= 2) await this.q(`releasegroup:(${frag.map((w) => w + '~').join(' AND ')})${TYPE}`, 'fuzzy-title');
    await this.expandArtists(1);
  }

  rank(): MbCand[] {
    const arr = [...this.map.values()];
    for (const c of arr) {
      c.ts = textScore(c, this.ocrWords);
      c.textScore = c.ts.total;
    }
    arr.sort((a, b) => b.ts!.total + b.mbScore / 1000 - (a.ts!.total + a.mbScore / 1000));
    return arr;
  }

  async expandArtists(n: number) {
    const byArtist = new Map<string, { id: string; name: string; s: number; n: number }>();
    for (const c of this.map.values()) {
      if (!c.artistId) continue;
      const s = textScore(c, this.ocrWords).artist;
      const e = byArtist.get(c.artistId) || { id: c.artistId, name: c.artist, s: 0, n: 0 };
      e.s = Math.max(e.s, s);
      e.n++;
      byArtist.set(c.artistId, e);
    }
    const ranked = [...byArtist.values()]
      .filter((e) => e.s >= 0.75 && !this.expanded.has(e.id))
      .sort((a, b) => b.s - a.s || b.n - a.n);
    for (const e of ranked.slice(0, n)) {
      this.expanded.add(e.id);
      await this.q(`arid:${e.id}${STUDIO}`, 'artist-studio:' + e.name);
    }
  }

  async stageB(maxQ = 3) {
    const before = this.used;
    const toks: string[] = [];
    for (const p of this.phrases.slice(0, 8)) {
      for (const w of esc(p.text).split(' ')) {
        const l = w.toLowerCase();
        if (l.length >= 4 && !toks.includes(l)) toks.push(l);
      }
    }
    for (const t of toks) {
      if (this.used - before >= maxQ) break;
      await this.q(`(artist:${t}~ OR releasegroup:${t}~)${TYPE}`, 'token:' + t);
    }
    await this.expandArtists(1);
  }
}

export async function releaseGroupsForBarcode(code: string): Promise<MbCand[]> {
  const j = await mbJson(`${mbBase()}/ws/2/release?query=${encodeURIComponent('barcode:' + code)}&limit=10&fmt=json`);
  const releases = (j?.releases as Rg[] | undefined) || [];
  const out = new Map<string, MbCand>();
  for (const r of releases) {
    const rg = (r as Rg & { 'release-group'?: { id?: string; title?: string } })['release-group'];
    if (!rg?.id) continue;
    out.set(rg.id, {
      rgid: rg.id,
      title: rg.title || r.title || '',
      artist: acName(r),
      artistId: acId(r),
      mbScore: r.score || 100,
      src: 'barcode',
    });
  }
  return [...out.values()];
}

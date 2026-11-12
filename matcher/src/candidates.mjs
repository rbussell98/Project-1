import { mbJson } from './net.mjs';
import { ocrWordSet, textScore } from './textmatch.mjs';
const MB = 'https://musicbrainz.org/ws/2/release-group';
const esc = (s) => s.replace(/["\\]/g, ' ').replace(/[+\-&|!(){}\[\]^~*?:\/]/g, ' ').replace(/\s+/g, ' ').trim();
const TYPE = ' AND (primarytype:album OR primarytype:ep)';
const STUDIO = ' AND primarytype:album AND -secondarytype:compilation AND -secondarytype:remix AND -secondarytype:dj-mix AND -secondarytype:mixtape/street';
const acName = (rg) => (rg['artist-credit'] || []).map((a) => (a.name || '') + (a.joinphrase || '')).join('');
const acId = (rg) => (rg['artist-credit'] || [])[0]?.artist?.id;
const toCand = (rg, src) => ({ rgid: rg.id, title: rg.title, artist: acName(rg), artistId: acId(rg), mbScore: rg.score ?? 0, src });
const search = async (q, limit = 100) => ((await mbJson(`${MB}?query=${encodeURIComponent(q)}&limit=${limit}&fmt=json`))?.['release-groups'] || []);

export class CandidatePool {
  constructor(phrases, log = () => {}) {
    this.phrases = phrases; this.ocrWords = ocrWordSet(phrases); this.log = log;
    this.map = new Map(); this.used = 0; this.expanded = new Set(); this.tried = new Set();
  }
  add(c) { const e = this.map.get(c.rgid); if (!e) this.map.set(c.rgid, { ...c }); else { e.mbScore = Math.max(e.mbScore, c.mbScore); } }
  async q(query, tag) {
    if (this.tried.has(query)) return [];
    this.tried.add(query); this.used++;
    this.log('MB', tag, query);
    const rgs = await search(query);
    for (const rg of rgs) this.add(toCand(rg, tag));
    return rgs;
  }
  // Stage A: ONE combined query over the top OCR phrases (both fields), + expand the artist that OCR says it is
  async stageA() {
    const P = this.phrases.slice(0, 5).map((p) => esc(p.text)).filter((t) => t.length >= 3);
    if (!P.length) return;
    const clauses = P.flatMap((p) => [`artist:"${p}"`, `releasegroup:"${p}"`]);
    await this.q(`(${clauses.join(' OR ')})${TYPE}`, 'combined');
    // OCR often returns title fragments ("Maide" / "oyage" / "Voyage"): AND the fuzzy fragments together in the title field
    const frag = [...new Set(P.slice(0, 4).flatMap((p) => p.toLowerCase().split(' ')).filter((w) => w.length >= 4))].slice(0, 4);
    if (frag.length >= 2) await this.q(`releasegroup:(${frag.map((w) => w + '~').join(' AND ')})${TYPE}`, 'fuzzy-title');
    await this.expandArtists(1);
  }
  rank() {
    const arr = [...this.map.values()];
    for (const c of arr) { c.ts = textScore(c, this.ocrWords); c.textScore = c.ts.total; }
    arr.sort((a, b) => (b.ts.total + b.mbScore / 1000) - (a.ts.total + a.mbScore / 1000));
    return arr;
  }
  async expandArtists(n) {
    // artists whose NAME the OCR text actually matches, by local score
    const byArtist = new Map();
    for (const c of this.map.values()) {
      if (!c.artistId) continue; const s = textScore(c, this.ocrWords).artist;
      const e = byArtist.get(c.artistId) || { id: c.artistId, name: c.artist, s: 0, n: 0 }; e.s = Math.max(e.s, s); e.n++; byArtist.set(c.artistId, e);
    }
    const ranked = [...byArtist.values()].filter((e) => e.s >= 0.75 && !this.expanded.has(e.id)).sort((a, b) => b.s - a.s || b.n - a.n);
    for (const e of ranked.slice(0, n)) {
      this.expanded.add(e.id);
      await this.q(`arid:${e.id}${STUDIO}`, 'artist-studio:' + e.name);
    }
  }
  // Stage B (only when image ranking is unsure): broader seeding from single words / fuzzy words
  async stageB(maxQ = 3) {
    const before = this.used;
    const toks = [];
    for (const p of this.phrases.slice(0, 8)) for (const w of esc(p.text).split(' ')) { const l = w.toLowerCase(); if (l.length >= 4 && !toks.includes(l)) toks.push(l); }
    for (const t of toks) {
      if (this.used - before >= maxQ) break;
      await this.q(`(artist:${t}~ OR releasegroup:${t}~)${TYPE}`, 'token:' + t);
    }
    await this.expandArtists(1);
  }
}

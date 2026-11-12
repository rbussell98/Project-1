import fs from 'node:fs';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { loadPhoto } from './imageprep.mjs';
import { makeOcr, buildJobs, goodLines } from './ocr.mjs';
import { CandidatePool } from './candidates.mjs';
import { caaFetch } from './net.mjs';
import { loadEmbedder, embedMany, dot } from './embed.mjs';
import { cropCover } from './cropcover.mjs';
import { decodeBarcode, releaseGroupsForBarcode } from './barcode.mjs';
import { loadPopularIndex } from './popindex.mjs';
import { textScore } from './textmatch.mjs';
import { fastAccept, isConfident, blend } from './rank.mjs';

export const CONFIG = {
  maxThumbs: 40,          // CAA thumbnails downloaded+embedded per stage (index hits need no download)
  stageB: true, stageBQueries: 2,
  thumbConcurrency: 10,
  fastSim: 0.90, fastMargin: 0.06, // visual-index fast path: skip OCR + MusicBrainz entirely
  textWeight: 0.15,       // score = cosine + textWeight * textMatch
  indexK: 8,              // popular-index neighbours merged into the candidate set
  confSim: 0.80, confMargin: 0.04, // auto-accept thresholds
  ocrProfile: 'standard', ocrOnCrop: true, ocrWorkers: 3,
};

async function pmap(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}

export async function createMatcher(cfg = {}) {
  const C = { ...CONFIG, ...cfg };
  // OCR workers are created only if the visual fast path does not accept.
  let ocr = null;
  async function getOcr() {
    if (!ocr) ocr = await makeOcr(C.ocrWorkers);
    return ocr;
  }
  await loadEmbedder();
  const idx = C.useIndex === false ? null : (() => { try { return loadPopularIndex(undefined, new Set(C.excludeFromIndex || [])); } catch { return null; } })();
  const thumbEmb = new Map(); // rgid -> Float32Array | null
  const ocrCache = C.ocrCacheDir || null; if (ocrCache) fs.mkdirSync(ocrCache, { recursive: true });

  async function identify(input, { log = () => {}, skipBarcode = false } = {}) {
    const t = { start: Date.now() }; const mark = (k) => (t[k] = Date.now() - t.start);
    const photo = await loadPhoto(input);
    let cover = null; try { cover = await cropCover(photo.buf, { out: 1024 }); } catch (e) { log('crop err', e.message); }
    mark('crop');
    // 1. barcode
    let barcode = null, bcCands = [];
    if (!skipBarcode) { try { barcode = await decodeBarcode(photo.buf); } catch (e) { log('barcode err', e.message); } }
    if (barcode) { try { bcCands = await releaseGroupsForBarcode(barcode); } catch (e) { log('barcode lookup err', e.message); } }
    mark('barcode');
    // 2. photo embeddings (cover crop first, then whole photo + centre crops as fallbacks)
    const cropBufs = [];
    if (cover) cropBufs.push(cover.buf);
    cropBufs.push(photo.buf);
    for (const [x, y, w, h] of [[0.08, 0.08, 0.84, 0.84], [0.18, 0.18, 0.64, 0.64]])
      cropBufs.push(await sharp(photo.buf).extract({ left: Math.round(x * photo.width), top: Math.round(y * photo.height), width: Math.round(w * photo.width), height: Math.round(h * photo.height) }).toBuffer());
    const photoEmbs = await embedMany(cropBufs);
    mark('photoEmbed');
    // 2b. fast path: visual index says it is clearly one album -> done in ~1-2 s, no OCR, no MusicBrainz
    const idxHitsAll = [];
    if (idx) {
      const m = new Map();
      for (const e of photoEmbs.slice(0, 2)) for (const h of idx.search(e, C.indexK)) if (!m.has(h.rgid) || m.get(h.rgid).sim < h.sim) m.set(h.rgid, h);
      idxHitsAll.push(...[...m.values()].sort((a, b) => b.sim - a.sim));
      const [a, b] = idxHitsAll;
      if (fastAccept(a, b, C)) {
        mark('done');
        return { barcode, phrases: [], mbQueries: 0, nCandidates: idx.n, nWithArt: idxHitsAll.length, usedStageB: false, fast: true, confident: true, cropFound: !!cover,
          ranked: idxHitsAll.slice(0, 10).map((h) => ({ rgid: h.rgid, title: h.title, artist: h.artist, src: 'index', sim: h.sim, text: 0, score: blend(h.sim, 0, C.textWeight) })), timing: t };
      }
    }
    // 3. OCR -> clean phrases (only used to GENERATE candidates + a small text bonus)
    let phrases;
    const ck = ocrCache && crypto.createHash('sha1').update(photo.buf).digest('hex') + (C.ocrOnCrop ? '_c' : '');
    if (ck && fs.existsSync(`${ocrCache}/${ck}.json`)) phrases = JSON.parse(fs.readFileSync(`${ocrCache}/${ck}.json`));
    else {
      const src = C.ocrOnCrop && cover ? cover.buf : photo.buf;
      // round 1: whole-cover passes only (4 jobs); round 2 (top/bottom halves, 8 jobs) only if round 1 found nothing solid
      let lines = await (await getOcr()).run(await buildJobs(src, C.ocrProfile, ['whole']));
      let g = goodLines(lines);
      const solid = (gl) => gl.length && (gl[0].key.length >= 8 || gl.length >= 2) && gl[0].score >= 100;
      if (!solid(g)) { lines = lines.concat(await (await getOcr()).run(await buildJobs(src, C.ocrProfile, ['top', 'bottom']))); g = goodLines(lines); }
      if (cover && C.ocrOnCrop && !solid(g)) { lines = lines.concat(await (await getOcr()).run(await buildJobs(photo.buf, C.ocrProfile, ['whole']))); g = goodLines(lines); }
      phrases = g.slice(0, 8).map((p) => ({ text: p.text, score: p.score, count: p.count }));
      if (ck) fs.writeFileSync(`${ocrCache}/${ck}.json`, JSON.stringify(phrases));
    }
    mark('ocr');
    // 4. candidates: barcode + MusicBrainz text search (stage A) + popular-index visual neighbours
    const pool = new CandidatePool(phrases, log);
    for (const c of bcCands) pool.add({ ...c, mbScore: 100 });
    await pool.stageA();
    mark('mbA');
    const idxCands = [];
    for (const h of idxHitsAll) { idxCands.push({ rgid: h.rgid, title: h.title, artist: h.artist, mbScore: 0, src: 'index' }); thumbEmb.set(h.rgid, idx.vec(h.i)); }
    const embedThumbs = async (limit) => {
      const cands = pool.rank().slice(0, limit);
      for (const c of pool.rank().slice(0, limit * 3)) if (idx && !thumbEmb.has(c.rgid) && idx.has(c.rgid)) thumbEmb.set(c.rgid, idx.vec(idx.idxOf(c.rgid)));
      const need = cands.filter((c) => !thumbEmb.has(c.rgid));
      const bufs = await pmap(need, C.thumbConcurrency, (c) => caaFetch(`https://coverartarchive.org/release-group/${c.rgid}/front-250`));
      for (let i = 0; i < need.length; i++) {
        if (!bufs[i]) { thumbEmb.set(need[i].rgid, null); continue; }
        try { thumbEmb.set(need[i].rgid, (await embedMany([bufs[i]]))[0]); } catch { thumbEmb.set(need[i].rgid, null); }
      }
    };
    const rankAll = () => {
      const seen = new Map();
      for (const c of [...pool.rank().slice(0, (C.maxThumbs + (pool.usedB ? 40 : 0)) * 3), ...idxCands]) if (!seen.has(c.rgid)) seen.set(c.rgid, c);
      const out = [];
      for (const c of seen.values()) {
        const e = thumbEmb.get(c.rgid); if (!e) continue;
        const sim = Math.max(...photoEmbs.map((p) => dot(p, e)));
        const ts = textScore(c, pool.ocrWords);
        out.push({ rgid: c.rgid, title: c.title, artist: c.artist, src: c.src, sim, text: ts.total, textBoth: ts.both, score: blend(sim, ts.total, C.textWeight) });
      }
      return out.sort((a, b) => b.score - a.score);
    };
    await embedThumbs(C.maxThumbs);
    mark('thumbsA');
    let ranked = rankAll();
    const confident = (r) => isConfident(r, C);
    let usedStageB = false;
    if (!confident(ranked) && C.stageB && phrases.length && !(ranked[0] && ranked[0].sim >= 0.78 && ranked[0].text >= 0.7)) {
      usedStageB = true; pool.usedB = true;
      await pool.stageB(C.stageBQueries);
      await embedThumbs(C.maxThumbs + 40);
      ranked = rankAll();
    }
    mark('done');
    return { barcode, phrases, mbQueries: pool.used, nCandidates: pool.map.size, nWithArt: ranked.length, usedStageB, confident: confident(ranked), cropFound: !!cover, ranked: ranked.slice(0, 10), timing: t };
  }
  return { identify, close: () => (ocr ? ocr.close() : undefined), C };
}

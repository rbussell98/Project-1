import { env, AutoProcessor, CLIPVisionModelWithProjection, RawImage } from '@huggingface/transformers';
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader';
import type { EmbRow } from '../db';
import type { IdentifyResult, RankedAlbum } from '../types';
import { CandidatePool, releaseGroupsForBarcode, type MbCand } from './candidates';
import { cropCover } from './crop';
import {
  adaptiveBinarize,
  canvasPixels,
  canvasToBlob,
  cropFrac,
  decodePhoto,
  resizeWidth,
  type CvLike,
} from './images';
import { caaBase, caaFetchBlob } from './net';
import { goodLines, type OcrLine } from './ocrtext';
import { dot, l2, openIndex, type PopularIndex } from './popindex';
import { blend, fastAccept, INDEX_K, isConfident } from './rank';
import { textScore } from './textmatch';

env.allowLocalModels = false;
env.useBrowserCache = true;
const wasm = env.backends.onnx.wasm;
if (wasm) {
  wasm.wasmPaths = {
    mjs: new URL('/ort/ort-wasm-simd-threaded.mjs', location.origin).href,
    wasm: new URL('/ort/ort-wasm-simd-threaded.wasm', location.origin).href,
  };
  wasm.numThreads = 1;
}

const post = (msg: unknown, transfer?: Transferable[]) => {
  const scope = globalThis as unknown as { postMessage: (data: unknown, transfer?: Transferable[]) => void };
  scope.postMessage(msg, transfer);
};

class Cancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'Cancelled';
  }
}

let cvPromise: Promise<CvLike> | null = null;
function loadCv(): Promise<CvLike> {
  if (!cvPromise) {
    cvPromise = (async () => {
      const res = await fetch('/opencv/opencv.js');
      if (!res.ok) throw new Error('Cover detection failed to load');
      const text = await res.text();
      (0, eval)(text);
      const cv = (globalThis as unknown as { cv: CvLike | Promise<CvLike> }).cv;
      return await cv;
    })();
  }
  return cvPromise;
}

type EmbedModel = (inputs: unknown) => Promise<{ image_embeds: { data: Float32Array } }>;
type Processor = (img: unknown, opts: unknown) => Promise<unknown>;
let model: EmbedModel | null = null;
let proc: Processor | null = null;
let clipFailed = false;

async function loadEmbedder(onProgress: (n: number) => void): Promise<void> {
  if (model && proc) return;
  if (clipFailed) throw new Error('Image model unavailable');
  try {
    const loaded = await CLIPVisionModelWithProjection.from_pretrained('Xenova/clip-vit-base-patch32', {
      dtype: 'q8',
      progress_callback: (p: { status?: string; loaded?: number; total?: number }) => {
        if (p?.total) onProgress((p.loaded || 0) / p.total);
        else onProgress(0);
      },
    });
    model = loaded as unknown as EmbedModel;
    proc = (await AutoProcessor.from_pretrained('Xenova/clip-vit-base-patch32')) as unknown as Processor;
  } catch (err) {
    clipFailed = true;
    model = null;
    proc = null;
    throw err instanceof Error ? err : new Error(String(err));
  }
}

async function embedCanvas(canvas: OffscreenCanvas): Promise<Float32Array> {
  if (!model || !proc) throw new Error('Image model unavailable');
  const square = new OffscreenCanvas(224, 224);
  const ctx = square.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not prepare the cover');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, 224, 224);
  const img = ctx.getImageData(0, 0, 224, 224);
  const rgb = new Uint8ClampedArray(224 * 224 * 3);
  for (let i = 0, j = 0; i < img.data.length; i += 4) {
    rgb[j++] = img.data[i];
    rgb[j++] = img.data[i + 1];
    rgb[j++] = img.data[i + 2];
  }
  const raw = new RawImage(rgb, 224, 224, 3);
  const inputs = await proc(raw, { do_resize: false, do_center_crop: false });
  const { image_embeds } = await model(inputs);
  return l2(image_embeds.data);
}

async function embedBlob(blob: Blob): Promise<Float32Array> {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not read cover art');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return embedCanvas(canvas);
}

let zxingReady: Promise<unknown> | null = null;
function prepareZxing() {
  if (!zxingReady) {
    zxingReady = prepareZXingModule({
      overrides: { locateFile: (file: string) => new URL('/zxing/' + file, location.origin).href },
      fireImmediately: true,
    });
  }
  return zxingReady;
}

function stretchGray(src: OffscreenCanvas): OffscreenCanvas {
  const img = canvasPixels(src);
  let min = 255;
  let max = 0;
  const gray = new Uint8Array(img.width * img.height);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    const g = (img.data[p] * 77 + img.data[p + 1] * 150 + img.data[p + 2] * 29) >> 8;
    gray[i] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const span = Math.max(1, max - min);
  const canvas = new OffscreenCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return src;
  const out = ctx.createImageData(img.width, img.height);
  for (let i = 0; i < gray.length; i++) {
    const v = ((gray[i] - min) * 255) / span;
    out.data[i * 4] = v;
    out.data[i * 4 + 1] = v;
    out.data[i * 4 + 2] = v;
    out.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

async function decodeBarcode(canvas: OffscreenCanvas): Promise<string | null> {
  // Barcode hits only matter when the visual fast path does not accept.
  // ZXing with tryRotate on a full photo can stall the worker, so scan a
  // smaller copy and give up if it has not answered.
  const scan = resizeWidth(canvas, Math.min(canvas.width, 900));
  const work = (async () => {
    await prepareZxing();
    const variants = [scan, stretchGray(scan)];
    for (const v of variants) {
      const img = canvasPixels(v);
      const res = await readBarcodes(img, {
        formats: ['EAN-13', 'UPC-A', 'UPC-E', 'EAN-8'],
        tryHarder: true,
        tryRotate: true,
        tryInvert: true,
        maxNumberOfSymbols: 2,
      });
      for (const r of res) if (r.isValid && /^\d{8,14}$/.test(r.text)) return r.text;
    }
    return null;
  })();
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000));
  return Promise.race([work, timeout]);
}

interface OcrJob {
  img: Blob;
  psm: string;
  tag: string;
}
interface OcrRunner {
  run: (jobs: OcrJob[]) => Promise<OcrLine[]>;
  close: () => Promise<void>;
}

async function makeOcr(n = 2): Promise<OcrRunner> {
  const { createWorker, PSM } = await import('tesseract.js');
  const workers: Awaited<ReturnType<typeof createWorker>>[] = [];
  for (let i = 0; i < n; i++) {
    workers.push(
      await createWorker('eng', 1, {
        workerPath: new URL('/tesseract/worker.min.js', location.origin).href,
        corePath: new URL('/tesseract/tesseract-core-simd-lstm.wasm.js', location.origin).href,
        langPath: new URL('/tesseract', location.origin).href,
        workerBlobURL: false,
        gzip: true,
        logger: () => {},
        errorHandler: () => {},
      }),
    );
  }
  return {
    async run(jobs) {
      const out: OcrLine[] = [];
      let next = 0;
      await Promise.all(
        workers.map(async (w) => {
          let cur = '';
          while (next < jobs.length) {
            const j = jobs[next++];
            if (j.psm !== cur) {
              await w.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, user_defined_dpi: '300' });
              cur = j.psm;
            }
            try {
              const { data } = await w.recognize(j.img, {}, { blocks: true });
              for (const b of data.blocks || [])
                for (const para of b.paragraphs || [])
                  for (const line of para.lines || [])
                    out.push({ text: line.text.trim(), conf: line.confidence, tag: j.tag });
            } catch {
              /* a bad pass is ignored */
            }
          }
        }),
      );
      return out;
    },
    async close() {
      await Promise.all(workers.map((w) => w.terminate()));
    },
  };
}

async function buildJobs(cv: CvLike, src: OffscreenCanvas, only: string[]): Promise<OcrJob[]> {
  const regions: [string, number, number, number, number][] = [
    ['whole', 0, 0, 1, 1],
    ['top', 0, 0, 1, 0.5],
    ['bottom', 0, 0.5, 1, 0.5],
  ];
  const adapt: [number, number][] = [
    [25, 12],
    [50, 8],
  ];
  const jobs: OcrJob[] = [];
  for (const [name, x, y, w, h] of regions) {
    if (!only.includes(name)) continue;
    let base = name === 'whole' ? src : cropFrac(src, x, y, w, h);
    base = resizeWidth(base, 1800);
    for (const pol of ['dark', 'bright'] as const) {
      for (const [sigma, off] of adapt) {
        const bin = adaptiveBinarize(cv, base, sigma, off, pol);
        jobs.push({
          img: await canvasToBlob(bin, 'image/png', 1),
          psm: '11',
          tag: `${name}/${pol}/s${sigma}/psm11`,
        });
      }
    }
  }
  return jobs;
}

let indexPromise: Promise<PopularIndex> | null = null;
function loadIndex(): Promise<PopularIndex> {
  if (!indexPromise) {
    indexPromise = (async () => {
      const [metaRes, binRes] = await Promise.all([fetch('/index/big-meta.json'), fetch('/index/big-int8.bin')]);
      if (!metaRes.ok || !binRes.ok) throw new Error('The album index is missing');
      const meta = (await metaRes.json()) as [string, string, string][];
      return openIndex(meta, await binRes.arrayBuffer());
    })().catch((err) => {
      indexPromise = null;
      throw err;
    });
  }
  return indexPromise;
}

async function pmap<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

type Hit = { rgid: string; artist: string; title: string; sim: number };

function searchShelf(q: Float32Array, users: EmbRow[], k: number): Hit[] {
  const hits: Hit[] = [];
  for (const u of users) {
    const v = new Float32Array(u.vec);
    hits.push({ rgid: u.rgid || u.key, artist: u.artist, title: u.title, sim: dot(q, v) });
  }
  hits.sort((a, b) => b.sim - a.sim);
  return hits.slice(0, k);
}

function mergeHits(groups: Hit[][]): Hit[] {
  const m = new Map<string, Hit>();
  for (const group of groups) {
    for (const h of group) {
      const prev = m.get(h.rgid);
      if (!prev || prev.sim < h.sim) m.set(h.rgid, h);
    }
  }
  return [...m.values()].sort((a, b) => b.sim - a.sim);
}

let generation = 0;
let queue: Promise<unknown> = Promise.resolve();

function enqueue(fn: () => Promise<void>) {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
}

interface InMsg {
  type: 'identify' | 'embed' | 'cancel';
  id?: string;
  buf?: ArrayBuffer;
  users?: EmbRow[];
}

async function identify(id: string, buf: ArrayBuffer, users: EmbRow[], gen: number): Promise<void> {
  const abort = () => {
    if (gen !== generation) throw new Cancelled();
  };
  const status = (step: string, progress: number | null = null) => {
    if (gen !== generation) return;
    post({ type: 'status', id, step, progress });
  };
  const t: Record<string, number> = { start: Date.now() };
  const mark = (k: string) => {
    t[k] = Date.now() - t.start;
  };

  status('Finding the cover');
  const photo = await decodePhoto(buf, 1600);
  abort();
  let cover: OffscreenCanvas | null = null;
  let cv: CvLike | null = null;
  try {
    cv = await loadCv();
    cover = await cropCover(cv, photo, 1024, 640);
  } catch (err) {
    cover = null;
    if (!cv) console.warn(err);
  }
  mark('crop');
  abort();

  status('Matching the artwork');
  let clip = true;
  let photoEmbs: Float32Array[] = [];
  try {
    await loadEmbedder((n) => status('Downloading image model, one time only', n));
    status('Matching the artwork');
    const views: OffscreenCanvas[] = [];
    if (cover) views.push(cover);
    views.push(photo, cropFrac(photo, 0.08, 0.08, 0.84, 0.84), cropFrac(photo, 0.18, 0.18, 0.64, 0.64));
    for (const view of views) {
      abort();
      photoEmbs.push(await embedCanvas(view));
    }
  } catch (err) {
    clip = false;
    photoEmbs = [];
    console.warn(err);
  }
  mark('photoEmbed');
  abort();

  const idx = await loadIndex().catch(() => null);
  const idxHits: Hit[] = [];
  if (clip && photoEmbs.length) {
    const groups: Hit[][] = [];
    for (const e of photoEmbs.slice(0, 2)) {
      if (idx) groups.push(idx.search(e, INDEX_K));
      if (users.length) groups.push(searchShelf(e, users, INDEX_K));
    }
    idxHits.push(...mergeHits(groups));
    const [a, b] = idxHits;
    if (fastAccept(a, b)) {
      mark('done');
      const ranked: RankedAlbum[] = idxHits.slice(0, 10).map((h) => ({
        rgid: h.rgid,
        artist: h.artist,
        title: h.title,
        sim: h.sim,
        text: 0,
        score: blend(h.sim, 0),
        src: 'index',
      }));
      status(`Found: ${ranked[0].artist} - ${ranked[0].title}`);
      const result: IdentifyResult = {
        fast: true,
        confident: true,
        cropFound: !!cover,
        clip: true,
        phrases: [],
        ranked,
        timing: t,
        barcode: null,
        mbQueries: 0,
      };
      post({ type: 'result', id, result });
      return;
    }
  }

  let barcode: string | null = null;
  const bcCands: MbCand[] = [];
  try {
    barcode = await decodeBarcode(photo);
    if (barcode) for (const c of await releaseGroupsForBarcode(barcode)) bcCands.push({ ...c, mbScore: 100 });
  } catch (err) {
    console.warn(err);
  }
  abort();

  status('Reading text');
  let phrases: { text: string; score: number }[] = [];
  if (cv) {
    const ocr = await makeOcr(2);
    try {
      const src = cover || photo;
      const solid = (gl: { key: string; score: number }[]) =>
        gl.length > 0 && (gl[0].key.length >= 8 || gl.length >= 2) && gl[0].score >= 100;
      let lines = await ocr.run(await buildJobs(cv, src, ['whole']));
      abort();
      let g = goodLines(lines);
      if (!solid(g)) {
        lines = lines.concat(await ocr.run(await buildJobs(cv, src, ['top', 'bottom'])));
        g = goodLines(lines);
      }
      if (cover && !solid(g)) {
        lines = lines.concat(await ocr.run(await buildJobs(cv, photo, ['whole'])));
        g = goodLines(lines);
      }
      phrases = g.slice(0, 8).map((p) => ({ text: p.text, score: p.score }));
    } finally {
      await ocr.close();
    }
  }
  mark('ocr');
  abort();

  const pool = new CandidatePool(phrases, () => {
    const n = Math.max(pool.used, 1);
    status(`Searching MusicBrainz (${pool.used} of ${Math.max(3, n)})`);
  });
  for (const c of bcCands) pool.add(c);
  if (phrases.length || barcode) {
    status('Searching MusicBrainz (1 of 3)');
    await pool.stageA();
  }
  mark('mbA');
  abort();

  if (!clip) {
    const ranked: RankedAlbum[] = pool.rank().slice(0, 10).map((c) => ({
      rgid: c.rgid,
      artist: c.artist,
      title: c.title,
      sim: 0,
      text: c.textScore || 0,
      score: c.textScore || 0,
      src: c.src,
    }));
    if (!ranked.length) throw new Error('No match yet. Type the artist and album, or try another photo.');
    status(`Found: ${ranked[0].artist} - ${ranked[0].title}`);
    mark('done');
    post({
      type: 'result',
      id,
      result: {
        fast: false,
        confident: false,
        cropFound: !!cover,
        clip: false,
        phrases,
        ranked,
        timing: t,
        barcode,
        mbQueries: pool.used,
      } satisfies IdentifyResult,
    });
    return;
  }

  const thumbEmb = new Map<string, Float32Array | null>();
  for (const u of users) thumbEmb.set(u.rgid || u.key, new Float32Array(u.vec));
  for (const h of idxHits) {
    if (idx && idx.has(h.rgid) && !thumbEmb.has(h.rgid)) {
      const at = idx.idxOf(h.rgid);
      if (at != null) thumbEmb.set(h.rgid, idx.vec(at));
    }
  }

  const embedThumbs = async (limit: number) => {
    const cands = pool.rank().slice(0, limit);
    for (const c of pool.rank().slice(0, limit * 3)) {
      if (idx && !thumbEmb.has(c.rgid) && idx.has(c.rgid)) {
        const at = idx.idxOf(c.rgid);
        if (at != null) thumbEmb.set(c.rgid, idx.vec(at));
      }
    }
    const need = cands.filter((c) => !thumbEmb.has(c.rgid));
    const blobs = await pmap(need, 10, (c) => caaFetchBlob(`${caaBase()}/release-group/${c.rgid}/front-250`));
    for (let i = 0; i < need.length; i++) {
      abort();
      const blob = blobs[i];
      if (!blob) {
        thumbEmb.set(need[i].rgid, null);
        continue;
      }
      try {
        thumbEmb.set(need[i].rgid, await embedBlob(blob));
      } catch {
        thumbEmb.set(need[i].rgid, null);
      }
    }
  };

  const idxCands: MbCand[] = idxHits.map((h) => ({
    rgid: h.rgid,
    title: h.title,
    artist: h.artist,
    mbScore: 0,
    src: 'index',
  }));

  const rankAll = (): RankedAlbum[] => {
    const seen = new Map<string, MbCand>();
    const cap = (40 + (pool.usedB ? 40 : 0)) * 3;
    for (const c of [...pool.rank().slice(0, cap), ...idxCands]) if (!seen.has(c.rgid)) seen.set(c.rgid, c);
    const out: RankedAlbum[] = [];
    for (const c of seen.values()) {
      const e = thumbEmb.get(c.rgid);
      if (!e) continue;
      const sim = Math.max(...photoEmbs.map((p) => dot(p, e)));
      const ts = textScore(c, pool.ocrWords);
      out.push({
        rgid: c.rgid,
        title: c.title,
        artist: c.artist,
        src: c.src,
        sim,
        text: ts.total,
        score: blend(sim, ts.total),
      });
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  };

  await embedThumbs(40);
  abort();
  let ranked = rankAll();
  let usedStageB = false;
  if (!isConfident(ranked) && phrases.length && !(ranked[0] && ranked[0].sim >= 0.78 && ranked[0].text >= 0.7)) {
    usedStageB = true;
    pool.usedB = true;
    await pool.stageB(2);
    abort();
    await embedThumbs(80);
    ranked = rankAll();
  }
  mark('done');
  if (ranked[0]) status(`Found: ${ranked[0].artist} - ${ranked[0].title}`);
  else status('No artwork match');
  post({
    type: 'result',
    id,
    result: {
      fast: false,
      confident: isConfident(ranked),
      cropFound: !!cover,
      clip: true,
      phrases,
      ranked: ranked.slice(0, 10),
      timing: t,
      barcode,
      mbQueries: pool.used,
      usedStageB,
    },
  });
}

async function embed(id: string, buf: ArrayBuffer) {
  try {
    await loadEmbedder(() => {});
    const photo = await decodePhoto(buf, 800);
    const vec = await embedCanvas(photo);
    post({ type: 'embedded', id, vec: vec.buffer }, [vec.buffer]);
  } catch (err) {
    post({ type: 'embedded', id, vec: null, message: err instanceof Error ? err.message : String(err) });
  }
}

const scope = globalThis as unknown as { onmessage: ((ev: MessageEvent<InMsg>) => void) | null };
scope.onmessage = (ev) => {
  const msg = ev.data;
  if (!msg || msg.type === 'cancel') {
    generation++;
    return;
  }
  if (msg.type === 'embed' && msg.id && msg.buf) {
    const id = msg.id;
    const buf = msg.buf;
    enqueue(() => embed(id, buf));
    return;
  }
  if (msg.type === 'identify' && msg.id && msg.buf) {
    const id = msg.id;
    const buf = msg.buf;
    const users = msg.users || [];
    const gen = ++generation;
    enqueue(async () => {
      try {
        await identify(id, buf, users, gen);
      } catch (err) {
        if (err instanceof Cancelled || gen !== generation) return;
        post({ type: 'error', id, message: err instanceof Error ? err.message : String(err) });
      }
    });
  }
};

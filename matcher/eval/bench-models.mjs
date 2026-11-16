// Compare vision encoders for the sleeve index.
// prepare: download a spread of CAA thumbs + phone-like queries
// run:     embed with one model and write a result json
// summarize: print the table
//
// Usage:
//   node matcher/eval/bench-models.mjs prepare
//   node matcher/eval/bench-models.mjs run Xenova/mobileclip_s0 q8
//   node matcher/eval/bench-models.mjs summarize
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { AutoProcessor, CLIPVisionModelWithProjection, RawImage, env } from '@huggingface/transformers';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const cache = path.join(root, '.cache/bench');
const coversDir = path.join(cache, 'covers');
const queryDir = path.join(cache, 'queries');
const resultsDir = path.join(cache, 'results');
const UA = 'Sleeve/1.0 (rbussell98@gmail.com)';
const META = path.join(root, 'public/index/big-meta.json');

const QUERY_N = 36;
const DISTRACTOR_N = 280;

function l2(v) {
  const o = new Float32Array(v.length);
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  s = Math.sqrt(s) || 1;
  for (let i = 0; i < v.length; i++) o[i] = v[i] / s;
  return o;
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

async function fetchCover(rgid) {
  const dest = path.join(coversDir, `${rgid}.jpg`);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 800) return dest;
  const url = `https://coverartarchive.org/release-group/${rgid}/front-250`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'image/jpeg' }, redirect: 'follow' });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 800) return null;
  fs.writeFileSync(dest, buf);
  return dest;
}

async function pmap(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k], k);
      }
    }),
  );
  return out;
}

async function degrade(buf, kind, seed) {
  const rot = kind === 'harsh' ? ((seed % 17) - 8) : ((seed % 9) - 4);
  const blur = kind === 'harsh' ? 1.6 : 0.7;
  const quality = kind === 'harsh' ? 42 : 68;
  const brightness = kind === 'harsh' ? 0.72 : 0.9;
  const base = await sharp(buf).rotate().resize(860, 860, { fit: 'fill' }).png().toBuffer();
  const tilted = await sharp(base)
    .rotate(rot, { background: { r: 78, g: 58, b: 42 } })
    .blur(blur)
    .modulate({ brightness, saturation: kind === 'harsh' ? 0.8 : 0.92 })
    .toBuffer();
  const meta = await sharp(tilted).metadata();
  const frac = kind === 'harsh' ? 0.78 : 0.9;
  const side = Math.round(Math.min(meta.width, meta.height) * frac);
  const left = Math.max(0, Math.min(meta.width - side, Math.round((meta.width - side) * (0.35 + (seed % 5) * 0.07))));
  const top = Math.max(0, Math.min(meta.height - side, Math.round((meta.height - side) * (0.4 + (seed % 3) * 0.08))));
  return sharp(tilted).extract({ left, top, width: side, height: side }).jpeg({ quality }).toBuffer();
}

async function prepare() {
  fs.mkdirSync(coversDir, { recursive: true });
  fs.mkdirSync(queryDir, { recursive: true });
  const meta = JSON.parse(fs.readFileSync(META, 'utf8'));
  const step = Math.floor(meta.length / (QUERY_N + DISTRACTOR_N + 20));
  const picked = [];
  const seen = new Set();
  const force = '3d88aa7d-fb1c-433f-9df6-e3d294671304';
  const forceRow = meta.find((row) => row[0] === force);
  if (forceRow) {
    picked.push(forceRow);
    seen.add(force);
  }
  for (let i = 0; i < meta.length && picked.length < QUERY_N + DISTRACTOR_N + 40; i += Math.max(1, step)) {
    const row = meta[i];
    if (seen.has(row[0])) continue;
    seen.add(row[0]);
    picked.push(row);
  }
  console.log('candidates', picked.length);
  const ok = [];
  let n = 0;
  await pmap(picked, 6, async (row) => {
    const file = await fetchCover(row[0]);
    n++;
    if (n % 40 === 0) console.log('fetched', n, 'kept', ok.length);
    if (file) ok.push({ rgid: row[0], artist: row[1], title: row[2], file });
  });
  const queries = [];
  const distractors = [];
  for (const row of ok) {
    if (row.rgid === force || queries.length < QUERY_N) queries.push(row);
    else if (distractors.length < DISTRACTOR_N) distractors.push(row);
  }
  for (const [i, row] of queries.entries()) {
    const buf = fs.readFileSync(row.file);
    for (const kind of ['mild', 'harsh']) {
      const dest = path.join(queryDir, `${row.rgid}_${kind}.jpg`);
      if (!fs.existsSync(dest)) fs.writeFileSync(dest, await degrade(buf, kind, i * 13 + (kind === 'harsh' ? 5 : 1)));
    }
  }
  const jj = path.join(root, 'eval/real/jj_moonlight_screenshot.jpg');
  const manifest = {
    queries: queries.map((q) => ({
      rgid: q.rgid,
      artist: q.artist,
      title: q.title,
      clean: path.relative(root, q.file),
      mild: path.relative(root, path.join(queryDir, `${q.rgid}_mild.jpg`)),
      harsh: path.relative(root, path.join(queryDir, `${q.rgid}_harsh.jpg`)),
    })),
    distractors: distractors.map((d) => ({
      rgid: d.rgid,
      artist: d.artist,
      title: d.title,
      clean: path.relative(root, d.file),
    })),
    real: fs.existsSync(jj)
      ? { rgid: force, artist: 'Jack Johnson', title: 'Meet the Moonlight', file: 'eval/real/jj_moonlight_screenshot.jpg' }
      : null,
  };
  fs.writeFileSync(path.join(cache, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('queries', manifest.queries.length, 'distractors', manifest.distractors.length);
}

function imageSizeFor(id) {
  return id.includes('mobileclip') ? 256 : 224;
}

async function embedFile(proc, model, file, imageSize) {
  const { data, info } = await sharp(file)
    .rotate()
    .removeAlpha()
    .resize(imageSize, imageSize, { fit: 'fill', kernel: 'lanczos3' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const raw = new RawImage(new Uint8ClampedArray(data), info.width, info.height, 3);
  const inputs = await proc(raw, { do_resize: false, do_center_crop: false });
  const t0 = performance.now();
  const { image_embeds } = await model(inputs);
  const ms = performance.now() - t0;
  return { vec: l2(image_embeds.data), ms };
}

function rankOf(query, gallery) {
  let bestI = 0;
  let best = -Infinity;
  let second = -Infinity;
  for (let i = 0; i < gallery.length; i++) {
    const s = dot(query, gallery[i].vec);
    if (s > best) {
      second = best;
      best = s;
      bestI = i;
    } else if (s > second) second = s;
  }
  return { i: bestI, sim: best, second };
}

async function run(id, dtype) {
  const manifest = JSON.parse(fs.readFileSync(path.join(cache, 'manifest.json'), 'utf8'));
  env.cacheDir = path.join(root, '.cache/models');
  const imageSize = imageSizeFor(id);
  const tLoad = performance.now();
  const model = await CLIPVisionModelWithProjection.from_pretrained(id, {
    dtype,
    progress_callback: (p) => {
      if (p.status === 'progress' && p.total) {
        const pct = Math.round((100 * (p.loaded || 0)) / p.total);
        if (pct % 25 === 0) process.stdout.write(`\r${p.file || ''} ${pct}%   `);
      }
    },
  });
  const proc = await AutoProcessor.from_pretrained(id);
  const loadMs = performance.now() - tLoad;
  console.log('\nloaded', id, dtype, Math.round(loadMs), 'ms', 'size', imageSize);

  const gallery = [];
  const embedMs = [];
  const rows = [...manifest.queries, ...manifest.distractors];
  for (const row of rows) {
    const { vec, ms } = await embedFile(proc, model, path.join(root, row.clean), imageSize);
    embedMs.push(ms);
    gallery.push({ ...row, vec });
  }
  const byId = new Map(gallery.map((g, i) => [g.rgid, i]));

  async function score(kind) {
    let top1 = 0;
    let top3 = 0;
    const margins = [];
    const sims = [];
    for (const q of manifest.queries) {
      const file = kind === 'real' ? path.join(root, manifest.real.file) : path.join(root, q[kind]);
      if (kind === 'real' && q.rgid !== manifest.real.rgid) continue;
      const { vec, ms } = await embedFile(proc, model, file, imageSize);
      embedMs.push(ms);
      const scored = gallery.map((g) => ({ rgid: g.rgid, sim: dot(vec, g.vec) }));
      scored.sort((a, b) => b.sim - a.sim);
      const truthAt = scored.findIndex((s) => s.rgid === q.rgid);
      if (truthAt === 0) top1++;
      if (truthAt >= 0 && truthAt < 3) top3++;
      const mine = scored.find((s) => s.rgid === q.rgid);
      const rival = scored.find((s) => s.rgid !== q.rgid);
      sims.push(mine?.sim ?? 0);
      margins.push((mine?.sim ?? 0) - (rival?.sim ?? 0));
      if (kind === 'real') {
        console.log('REAL', scored[0].rgid === q.rgid ? 'HIT' : 'MISS', 'sim', mine?.sim?.toFixed(3), 'top', scored[0].rgid, scored[0].sim.toFixed(3));
      }
    }
    const n = kind === 'real' ? 1 : manifest.queries.length;
    sims.sort((a, b) => a - b);
    margins.sort((a, b) => a - b);
    const mid = (arr) => arr[Math.floor(arr.length / 2)] ?? 0;
    return { n, top1, top3, top1Rate: top1 / n, top3Rate: top3 / n, medianSim: mid(sims), medianMargin: mid(margins) };
  }

  const mild = await score('mild');
  const harsh = await score('harsh');
  const real = manifest.real ? await score('real') : null;
  embedMs.sort((a, b) => a - b);
  const mean = embedMs.reduce((s, x) => s + x, 0) / embedMs.length;
  const slug = `${id.split('/')[1]}-${dtype}`;
  const suffix = {
    q8: 'vision_model_quantized.onnx',
    fp16: 'vision_model_fp16.onnx',
    fp32: 'vision_model.onnx',
    q4: 'vision_model_q4.onnx',
    q4f16: 'vision_model_q4f16.onnx',
  }[dtype];
  let bytes = 0;
  const modelCache = path.join(root, '.cache/models');
  if (fs.existsSync(modelCache) && suffix) {
    const walk = (dir) => {
      for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        const st = fs.statSync(p);
        if (st.isDirectory()) walk(p);
        else if (p.includes(id.split('/')[1]) && p.endsWith(suffix)) bytes += st.size;
      }
    };
    walk(modelCache);
  }
  const result = {
    id,
    dtype,
    imageSize,
    dim: gallery[0]?.vec.length ?? 0,
    loadMs: Math.round(loadMs),
    embedMsMean: Math.round(mean),
    embedMsMedian: Math.round(embedMs[Math.floor(embedMs.length / 2)] || 0),
    onnxBytes: bytes,
    gallery: gallery.length,
    mild,
    harsh,
    real,
    indexHit: byId.size,
  };
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(path.join(resultsDir, `${slug}.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ slug, ...result, mild, harsh, real }, null, 2));
}

function summarize() {
  const files = fs.existsSync(resultsDir) ? fs.readdirSync(resultsDir).filter((f) => f.endsWith('.json')) : [];
  const rows = files.map((f) => JSON.parse(fs.readFileSync(path.join(resultsDir, f), 'utf8')));
  rows.sort((a, b) => b.mild.top1Rate - a.mild.top1Rate || a.onnxBytes - b.onnxBytes);
  for (const r of rows) {
    console.log(
      [
        r.id,
        r.dtype,
        `${(r.onnxBytes / 1e6).toFixed(1)}MB`,
        `load ${r.loadMs}ms`,
        `embed ${r.embedMsMedian}ms`,
        `mild ${r.mild.top1}/${r.mild.n} (${(r.mild.top1Rate * 100).toFixed(0)}%) top3 ${(r.mild.top3Rate * 100).toFixed(0)}%`,
        `harsh ${r.harsh.top1}/${r.harsh.n} (${(r.harsh.top1Rate * 100).toFixed(0)}%)`,
        `medSim ${r.mild.medianSim.toFixed(3)} medMargin ${r.mild.medianMargin.toFixed(3)}`,
        r.real ? `jj ${r.real.top1 ? 'hit' : 'miss'} sim ${r.real.medianSim.toFixed(3)}` : '',
      ].join(' | '),
    );
  }
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'prepare') await prepare();
else if (cmd === 'run') await run(a, b || 'q8');
else if (cmd === 'summarize') summarize();
else {
  console.error('usage: prepare | run <model-id> <dtype> | summarize');
  process.exit(1);
}

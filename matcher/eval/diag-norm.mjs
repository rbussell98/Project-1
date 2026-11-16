// Quick check: does MobileCLIP need CLIP mean/std even when its processor says do_normalize false?
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { AutoProcessor, CLIPVisionModelWithProjection, RawImage, env } from '@huggingface/transformers';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
env.cacheDir = path.join(root, '.cache/models');
const manifest = JSON.parse(fs.readFileSync(path.join(root, '.cache/bench/manifest.json'), 'utf8'));
const queries = manifest.queries.slice(0, 16);
const distractors = manifest.distractors.slice(0, 48);
const MEAN = [0.48145466, 0.4578275, 0.40821073];
const STD = [0.26862954, 0.26130258, 0.27577711];

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

async function embedFile(proc, model, file, imageSize, normalize) {
  const { data, info } = await sharp(file)
    .rotate()
    .removeAlpha()
    .resize(imageSize, imageSize, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const raw = new RawImage(new Uint8ClampedArray(data), info.width, info.height, 3);
  const imageProc = proc.image_processor || proc;
  imageProc.do_normalize = normalize;
  if (normalize) {
    imageProc.image_mean = MEAN;
    imageProc.image_std = STD;
  }
  const inputs = await proc(raw);
  if (!globalThis.__logged) {
    const px = inputs.pixel_values.data;
    let s = 0;
    for (let i = 0; i < 300; i++) s += px[i];
    console.log('pixel mean sample', (s / 300).toFixed(4), 'do_normalize', imageProc.do_normalize);
    globalThis.__logged = true;
  }
  const { image_embeds } = await model(inputs);
  return l2(image_embeds.data);
}

async function trial(id, dtype, normalize) {
  const imageSize = id.includes('mobileclip') ? 256 : 224;
  const t0 = performance.now();
  const model = await CLIPVisionModelWithProjection.from_pretrained(id, { dtype });
  const proc = await AutoProcessor.from_pretrained(id);
  console.log('loaded', id, dtype, 'norm', normalize, Math.round(performance.now() - t0), 'ms');
  const gallery = [];
  for (const row of [...queries, ...distractors]) {
    gallery.push({ rgid: row.rgid, vec: await embedFile(proc, model, path.join(root, row.clean), imageSize, normalize) });
  }
  let top1 = 0;
  const sims = [];
  const margins = [];
  for (const q of queries) {
    const vec = await embedFile(proc, model, path.join(root, q.mild), imageSize, normalize);
    const scored = gallery.map((g) => ({ rgid: g.rgid, sim: dot(vec, g.vec) })).sort((a, b) => b.sim - a.sim);
    if (scored[0].rgid === q.rgid) top1++;
    const mine = scored.find((s) => s.rgid === q.rgid).sim;
    const rival = scored.find((s) => s.rgid !== q.rgid).sim;
    sims.push(mine);
    margins.push(mine - rival);
  }
  sims.sort((a, b) => a - b);
  margins.sort((a, b) => a - b);
  const mid = (a) => a[Math.floor(a.length / 2)];
  console.log(JSON.stringify({ id, dtype, normalize, top1, n: queries.length, medianSim: mid(sims), medianMargin: mid(margins) }));
}

const [id, dtype, norm] = process.argv.slice(2);
await trial(id, dtype || 'q8', norm !== 'off');

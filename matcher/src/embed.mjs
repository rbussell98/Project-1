import sharp from 'sharp';
import { AutoProcessor, CLIPVisionModelWithProjection, RawImage, env } from '@huggingface/transformers';
env.cacheDir = process.env.SLEEVE_MODEL_CACHE || new URL('../../.cache/clip/', import.meta.url).pathname;
let model, proc;
export const MODEL_ID = process.env.SLEEVE_CLIP || 'Xenova/clip-vit-base-patch32';
export async function loadEmbedder(dtype = 'q8') {
  if (model) return;
  model = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, { dtype });
  proc = await AutoProcessor.from_pretrained(MODEL_ID);
}
// square-squash (no centre crop: covers are square; photos cropped to cover) -> 224x224 RGB
export async function toRaw224(buf) {
  const { data, info } = await sharp(buf).rotate().removeAlpha().resize(224, 224, { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
  return new RawImage(new Uint8ClampedArray(data), info.width, info.height, 3);
}
function norm(v) { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; const o = new Float32Array(v.length); for (let i = 0; i < v.length; i++) o[i] = v[i] / s; return o; }
export async function embedMany(bufs) {
  const out = [];
  for (const b of bufs) {
    const img = await toRaw224(b);
    const inputs = await proc(img, { do_resize: false, do_center_crop: false });
    const { image_embeds } = await model(inputs);
    out.push(norm(image_embeds.data));
  }
  return out;
}
export const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

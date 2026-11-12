import sharp from 'sharp';
import { createWorker, PSM } from 'tesseract.js';
const f = process.argv[2];
const w = await createWorker('eng');
async function adaptive(buf, sigma, off, invert) {
  const { data, info } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
  const blur = await sharp(buf).greyscale().blur(sigma).raw().toBuffer();
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) { const d = data[i] - blur[i]; const dark = d < -off; const bright = d > off; out[i] = (invert ? bright : dark) ? 0 : 255; }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 1 } }).png().toBuffer();
}
const meta = await sharp(f).metadata();
const up = await sharp(f).resize({ width: 1600 }).toBuffer();
const H = Math.round(1600 * meta.height / meta.width);
for (const [name, ext] of Object.entries({ whole: null, top: {left:0,top:0,width:1600,height:Math.round(H*0.5)}, mid:{left:0,top:Math.round(H*0.3),width:1600,height:Math.round(H*0.4)}})) {
 const base = ext ? await sharp(up).extract(ext).toBuffer() : up;
 for (const sigma of [10, 25, 50]) for (const off of [6, 12, 20]) for (const inv of [false, true]) {
  const b = await adaptive(base, sigma, off, inv);
  for (const psm of [PSM.SPARSE_TEXT, PSM.AUTO]) {
    await w.setParameters({ tessedit_pageseg_mode: psm });
    const { data } = await w.recognize(b, {}, { text: true });
    const lines = (data.text||'').split('\n').map(s=>s.trim()).filter(s=>/[A-Za-z]{4,}/.test(s));
    if (lines.length) console.log(name, 's'+sigma, 'o'+off, inv?'inv':'dark', 'psm'+psm, '=>', lines.slice(0,4).join(' | '));
  }
 }
}
await w.terminate();

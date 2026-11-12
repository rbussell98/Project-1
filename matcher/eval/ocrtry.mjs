import sharp from 'sharp';
import { createWorker, PSM } from 'tesseract.js';
const f = process.argv[2];
const w = await createWorker('eng');
const meta = await sharp(f).metadata();
const W = meta.width, H = meta.height;
const variants = {};
const base = (img) => img.resize({ width: 1600, withoutEnlargement: false }).greyscale();
const crops = { whole: [0,0,1,1], top: [0,0,1,0.4], mid:[0,0.3,1,0.4], bottom: [0,0.6,1,0.4] };
for (const [cn,[x,y,w_,h_]] of Object.entries(crops)) {
  const ext = { left: Math.round(x*W), top: Math.round(y*H), width: Math.round(w_*W), height: Math.round(h_*H) };
  const mk = () => sharp(f).extract(ext);
  variants[cn+'/norm'] = await base(mk()).normalise().toBuffer();
  variants[cn+'/inv'] = await base(mk()).normalise().negate().toBuffer();
  variants[cn+'/thr'] = await base(mk()).normalise().threshold(110).toBuffer();
  variants[cn+'/thrinv'] = await base(mk()).normalise().negate().threshold(110).toBuffer();
}
for (const psm of [PSM.SPARSE_TEXT, PSM.AUTO]) {
  await w.setParameters({ tessedit_pageseg_mode: psm });
  for (const [k, b] of Object.entries(variants)) {
    const t0 = Date.now();
    const { data } = await w.recognize(b, {}, { text: true, blocks: true });
    const lines = (data.text||"").split("\n").map(s=>s.trim()).filter(s=>s.length>3); console.log(psm,k,Date.now()-t0,"ms",lines.slice(0,6).join(" | "));
  }
}
await w.terminate();

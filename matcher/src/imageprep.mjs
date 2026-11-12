// Image preparation shared by OCR + embedding. Uses sharp in Node; the browser build uses canvas
// with the identical numeric recipe (see README).
import sharp from 'sharp';

export async function loadPhoto(input, longSide = 1600) {
  // .rotate() with no args applies EXIF orientation
  const buf = await sharp(input).rotate().resize({ width: longSide, height: longSide, fit: 'inside', withoutEnlargement: false })
    .removeAlpha().jpeg({ quality: 95 }).toBuffer();
  const m = await sharp(buf).metadata();
  return { buf, width: m.width, height: m.height };
}

// local-contrast ("adaptive") binarisation: pixel is ink if it is darker (or brighter) than its
// blurred neighbourhood by `off` grey levels. This is what makes block letters on gradient skies readable.
export async function adaptiveBinarize(buf, sigma, off, polarity /* 'dark' | 'bright' */) {
  const g = sharp(buf).greyscale();
  const { data, info } = await g.clone().raw().toBuffer({ resolveWithObject: true });
  const blur = await g.clone().blur(sigma).raw().toBuffer();
  const out = Buffer.alloc(data.length);
  const bright = polarity === 'bright';
  for (let i = 0; i < data.length; i++) {
    const d = data[i] - blur[i];
    const ink = bright ? d > off : d < -off;
    out[i] = ink ? 0 : 255;
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 1 } })
    .extend({ top: 20, bottom: 20, left: 20, right: 20, background: '#ffffff' }).png().toBuffer();
}
export async function plainGrey(buf, { normalise = true, negate = false } = {}) {
  let s = sharp(buf).greyscale();
  if (normalise) s = s.normalise();
  if (negate) s = s.negate();
  return s.png().toBuffer();
}
export async function cropFrac(buf, x, y, w, h) {
  const m = await sharp(buf).metadata();
  const left = Math.min(m.width - 8, Math.round(x * m.width)), top = Math.min(m.height - 8, Math.round(y * m.height));
  const width = Math.max(8, Math.min(m.width - left, Math.round(w * m.width))), height = Math.max(8, Math.min(m.height - top, Math.round(h * m.height)));
  return sharp(buf).extract({ left, top, width, height }).toBuffer();
}

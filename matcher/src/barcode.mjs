import { readBarcodes } from 'zxing-wasm/reader';
import sharp from 'sharp';
import { mbJson } from './net.mjs';
// Decode EAN-13/UPC-A from the photo (tries whole image + a few contrast variants).
export async function decodeBarcode(photoBuf) {
  const variants = [photoBuf];
  variants.push(await sharp(photoBuf).greyscale().normalise().toBuffer());
  variants.push(await sharp(photoBuf).greyscale().resize({ width: 2400, withoutEnlargement: false }).sharpen().toBuffer());
  for (const v of variants) {
    const { data, info } = await sharp(v).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const res = await readBarcodes({ data: new Uint8ClampedArray(data), width: info.width, height: info.height, colorSpace: 'SRGB' },
      { formats: ['EAN-13', 'UPC-A', 'UPC-E', 'EAN-8'], tryHarder: true, tryRotate: true, tryInvert: true, maxNumberOfSymbols: 2 });
    for (const r of res) if (r.isValid && /^\d{8,14}$/.test(r.text)) return r.text;
  }
  return null;
}
export async function releaseGroupsForBarcode(code) {
  const j = await mbJson(`https://musicbrainz.org/ws/2/release?query=barcode:${encodeURIComponent(code)}&limit=10&fmt=json`);
  const out = new Map();
  for (const r of j?.releases || []) {
    const rg = r['release-group']; if (!rg) continue;
    const ac = (r['artist-credit'] || []);
    out.set(rg.id, { rgid: rg.id, title: rg.title || r.title, artist: ac.map((a) => (a.name || '') + (a.joinphrase || '')).join(''), artistId: ac[0]?.artist?.id, mbScore: r.score || 0, src: 'barcode' });
  }
  return [...out.values()];
}

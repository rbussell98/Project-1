// Find the album cover (largest convex quadrilateral) in a phone photo and flatten it to a square.
// Pure OpenCV.js so the identical code runs in Node and in the browser.
import sharp from 'sharp';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let cvP;
async function getCv() { if (!cvP) { let c = require('@techstark/opencv-js'); cvP = c.then ? c.then((x) => { delete x.then; return x; }) : Promise.resolve(c); } return cvP; }

function order(pts) { // tl, tr, br, bl
  const s = pts.map((p) => p.x + p.y), d = pts.map((p) => p.x - p.y);
  return [pts[s.indexOf(Math.min(...s))], pts[d.indexOf(Math.max(...d))], pts[s.indexOf(Math.max(...s))], pts[d.indexOf(Math.min(...d))]];
}
export async function cropCover(photoBuf, { out = 512, work = 640 } = {}) {
  const cv = await getCv();
  const meta = await sharp(photoBuf).metadata();
  const scale = work / Math.max(meta.width, meta.height);
  const { data, info } = await sharp(photoBuf).resize({ width: Math.round(meta.width * scale) }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const src = new cv.Mat(info.height, info.width, cv.CV_8UC4); src.data.set(data);
  const gray = new cv.Mat(), tmp = new cv.Mat(), edges = new cv.Mat(), e2 = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  cv.GaussianBlur(gray, tmp, new cv.Size(5, 5), 0);
  const rgb = new cv.Mat(); cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
  const planes = new cv.MatVector(); cv.split(rgb, planes);
  const area = info.width * info.height; let best = null;
  const k = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
  const consider = (edgeMat) => {
    const contours = new cv.MatVector(), hier = new cv.Mat();
    cv.findContours(edgeMat, contours, hier, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i); const a = cv.contourArea(c);
      if (a < area * 0.08 || a > area * 0.98) { c.delete(); continue; }
      const hull = new cv.Mat(); cv.convexHull(c, hull);
      const hullA = cv.contourArea(hull);
      const peri = cv.arcLength(hull, true);
      for (const eps of [0.02, 0.035, 0.055]) {
        const ap = new cv.Mat(); cv.approxPolyDP(hull, ap, eps * peri, true);
        if (ap.rows === 4 && cv.isContourConvex(ap)) {
          const pts = []; for (let j = 0; j < 4; j++) pts.push({ x: ap.data32S[j * 2], y: ap.data32S[j * 2 + 1] });
          const q = order(pts);
          const dist = (p, r) => Math.hypot(p.x - r.x, p.y - r.y);
          const w = (dist(q[0], q[1]) + dist(q[3], q[2])) / 2, h = (dist(q[0], q[3]) + dist(q[1], q[2])) / 2;
          const ar = w / h; const qa = cv.contourArea(ap);
          const fill = Math.min(1, hullA / qa);
          if (ar > 0.55 && ar < 1.8 && qa > area * 0.08 && qa < area * 0.97 && fill > 0.8) {
            const touches = q.filter((p) => p.x < 3 || p.y < 3 || p.x > info.width - 4 || p.y > info.height - 4).length;
            // prefer big quads that are close to square and whose contour hugs the quad
            const sc = qa * (touches ? 0.4 : 1) * fill * (1 - 0.3 * Math.min(1, Math.abs(Math.log(ar))));
            if (!best || sc > best.sc) best = { q, sc, qa, ar };
          }
        }
        ap.delete();
      }
      hull.delete(); c.delete();
    }
    contours.delete(); hier.delete();
  };
  const med = (() => { const a = Array.from(tmp.data); a.sort((x, y) => x - y); return a[a.length >> 1]; })();
  const settings = [[0.33 * med, 0.66 * med + 20], [20, 60], [10, 30], [40, 110]];
  for (const [lo, hi] of settings) {
    cv.Canny(tmp, edges, Math.max(5, lo), Math.max(15, hi));
    cv.dilate(edges, edges, k); cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, k); consider(edges);
  }
  // colour-channel edges (low-contrast greys with a colour change at the border)
  for (let ch = 0; ch < 3; ch++) {
    const pl = planes.get(ch); cv.GaussianBlur(pl, tmp, new cv.Size(5, 5), 0); cv.Canny(tmp, e2, 15, 45);
    cv.dilate(e2, e2, k); cv.morphologyEx(e2, e2, cv.MORPH_CLOSE, k); consider(e2); pl.delete();
  }
  let result = null;
  if (best) {
    // warp from the full-resolution photo
    const full = await sharp(photoBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const fm = new cv.Mat(full.info.height, full.info.width, cv.CV_8UC4); fm.data.set(full.data);
    const q = best.q.map((p) => ({ x: p.x / scale, y: p.y / scale }));
    const sp = cv.matFromArray(4, 1, cv.CV_32FC2, q.flatMap((p) => [p.x, p.y]));
    const dp = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, out, 0, out, out, 0, out]);
    const M = cv.getPerspectiveTransform(sp, dp); const dst = new cv.Mat();
    cv.warpPerspective(fm, dst, M, new cv.Size(out, out), cv.INTER_AREA, cv.BORDER_REPLICATE);
    result = { quad: q, areaFrac: best.qa / area, buf: await sharp(Buffer.from(dst.data), { raw: { width: out, height: out, channels: 4 } }).removeAlpha().jpeg({ quality: 92 }).toBuffer() };
    fm.delete(); sp.delete(); dp.delete(); M.delete(); dst.delete();
  }
  [src, gray, edges, e2, tmp, k, rgb].forEach((m) => m.delete()); planes.delete();
  return result;
}

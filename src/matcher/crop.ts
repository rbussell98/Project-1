import type { CvLike, CvMat } from './images';
import { canvasPixels } from './images';

function order(pts: { x: number; y: number }[]) {
  const s = pts.map((p) => p.x + p.y);
  const d = pts.map((p) => p.x - p.y);
  return [
    pts[s.indexOf(Math.min(...s))],
    pts[d.indexOf(Math.max(...d))],
    pts[s.indexOf(Math.max(...s))],
    pts[d.indexOf(Math.min(...d))],
  ];
}

type Pt = { x: number; y: number };

/**
 * Largest convex quadrilateral, warped to a square. Same thresholds as matcher/src/cropcover.mjs.
 * Returns null when the sleeve edge is not a clean quad; the caller keeps the whole photo.
 */
export async function cropCover(cv: CvLike, photo: OffscreenCanvas, out = 1024, work = 640): Promise<OffscreenCanvas | null> {
  const scale = work / Math.max(photo.width, photo.height);
  const ww = Math.max(1, Math.round(photo.width * scale));
  const hh = Math.max(1, Math.round(photo.height * scale));
  const small = new OffscreenCanvas(ww, hh);
  const sctx = small.getContext('2d', { willReadFrequently: true });
  if (!sctx) return null;
  sctx.drawImage(photo, 0, 0, ww, hh);
  const pixels = canvasPixels(small);
  const src = new cv.Mat(hh, ww, cv.CV_8UC4);
  src.data.set(pixels.data);
  const gray = new cv.Mat();
  const tmp = new cv.Mat();
  const edges = new cv.Mat();
  const e2 = new cv.Mat();
  const rgb = new cv.Mat();
  const mats: CvMat[] = [src, gray, tmp, edges, e2, rgb];
  let k: CvMat | null = null;
  let planes: { get: (i: number) => CvMat; delete: () => void } | null = null;
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, tmp, new cv.Size(5, 5), 0);
    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
    planes = new cv.MatVector();
    cv.split(rgb, planes);
    const area = ww * hh;
    const found: { current: { q: Pt[]; sc: number; qa: number } | null } = { current: null };
    k = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    const consider = (edgeMat: CvMat) => {
      const contours = new cv.MatVector();
      const hier = new cv.Mat();
      cv.findContours(edgeMat, contours, hier, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
      for (let i = 0; i < contours.size(); i++) {
        const c = contours.get(i);
        const a = cv.contourArea(c);
        if (a < area * 0.08 || a > area * 0.98) {
          c.delete();
          continue;
        }
        const hull = new cv.Mat();
        cv.convexHull(c, hull);
        const hullA = cv.contourArea(hull);
        const peri = cv.arcLength(hull, true);
        for (const eps of [0.02, 0.035, 0.055]) {
          const ap = new cv.Mat();
          cv.approxPolyDP(hull, ap, eps * peri, true);
          if (ap.rows === 4 && cv.isContourConvex(ap)) {
            const pts: Pt[] = [];
            for (let j = 0; j < 4; j++) pts.push({ x: ap.data32S[j * 2], y: ap.data32S[j * 2 + 1] });
            const q = order(pts);
            const dist = (p: Pt, r: Pt) => Math.hypot(p.x - r.x, p.y - r.y);
            const w = (dist(q[0], q[1]) + dist(q[3], q[2])) / 2;
            const h = (dist(q[0], q[3]) + dist(q[1], q[2])) / 2;
            const ar = w / h;
            const qa = cv.contourArea(ap);
            const fill = Math.min(1, hullA / qa);
            if (ar > 0.55 && ar < 1.8 && qa > area * 0.08 && qa < area * 0.97 && fill > 0.8) {
              const touches = q.filter((p) => p.x < 3 || p.y < 3 || p.x > ww - 4 || p.y > hh - 4).length;
              const sc = qa * (touches ? 0.4 : 1) * fill * (1 - 0.3 * Math.min(1, Math.abs(Math.log(ar))));
              if (!found.current || sc > found.current.sc) found.current = { q, sc, qa };
            }
          }
          ap.delete();
        }
        hull.delete();
        c.delete();
      }
      contours.delete();
      hier.delete();
    };
    const sorted = Array.from(tmp.data).sort((x, y) => x - y);
    const med = sorted[sorted.length >> 1] || 0;
    const settings: [number, number][] = [
      [0.33 * med, 0.66 * med + 20],
      [20, 60],
      [10, 30],
      [40, 110],
    ];
    for (const [lo, hi] of settings) {
      cv.Canny(tmp, edges, Math.max(5, lo), Math.max(15, hi));
      cv.dilate(edges, edges, k);
      cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, k);
      consider(edges);
    }
    for (let ch = 0; ch < 3; ch++) {
      const pl = planes.get(ch);
      cv.GaussianBlur(pl, tmp, new cv.Size(5, 5), 0);
      cv.Canny(tmp, e2, 15, 45);
      cv.dilate(e2, e2, k);
      cv.morphologyEx(e2, e2, cv.MORPH_CLOSE, k);
      consider(e2);
      pl.delete();
    }
    const best = found.current;
    if (!best) return null;
    const fullPx = canvasPixels(photo);
    const fm = new cv.Mat(photo.height, photo.width, cv.CV_8UC4);
    fm.data.set(fullPx.data);
    const q = best.q.map((p) => ({ x: p.x / scale, y: p.y / scale }));
    const sp = cv.matFromArray(4, 1, cv.CV_32FC2, q.flatMap((p) => [p.x, p.y]));
    const dp = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, out, 0, out, out, 0, out]);
    const M = cv.getPerspectiveTransform(sp, dp);
    const dst = new cv.Mat();
    cv.warpPerspective(fm, dst, M, new cv.Size(out, out), cv.INTER_AREA, cv.BORDER_REPLICATE);
    const square = new OffscreenCanvas(out, out);
    const octx = square.getContext('2d');
    if (!octx) return null;
    const id = octx.createImageData(out, out);
    id.data.set(dst.data);
    octx.putImageData(id, 0, 0);
    fm.delete();
    sp.delete();
    dp.delete();
    M.delete();
    dst.delete();
    return square;
  } finally {
    for (const m of mats) m.delete?.();
    k?.delete?.();
    planes?.delete?.();
  }
}

// CvLike is extended at runtime with the methods above. Declare the extras we call.
declare module './images' {
  interface CvLike {
    cvtColor: (...args: unknown[]) => void;
    COLOR_RGBA2GRAY: number;
    COLOR_RGBA2RGB: number;
    MatVector: new () => { get: (i: number) => CvMat; size: () => number; delete: () => void };
    split: (...args: unknown[]) => void;
    getStructuringElement: (...args: unknown[]) => CvMat;
    MORPH_RECT: number;
    MORPH_CLOSE: number;
    findContours: (...args: unknown[]) => void;
    RETR_LIST: number;
    CHAIN_APPROX_SIMPLE: number;
    contourArea: (m: CvMat) => number;
    convexHull: (...args: unknown[]) => void;
    arcLength: (m: CvMat, closed: boolean) => number;
    approxPolyDP: (...args: unknown[]) => void;
    isContourConvex: (m: CvMat) => boolean;
    Canny: (...args: unknown[]) => void;
    dilate: (...args: unknown[]) => void;
    morphologyEx: (...args: unknown[]) => void;
    matFromArray: (...args: unknown[]) => CvMat;
    CV_32FC2: number;
    getPerspectiveTransform: (...args: unknown[]) => CvMat;
    warpPerspective: (...args: unknown[]) => void;
    INTER_AREA: number;
    BORDER_REPLICATE: number;
  }
}

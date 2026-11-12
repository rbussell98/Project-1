export async function decodePhoto(buf: ArrayBuffer, longSide = 1600): Promise<OffscreenCanvas> {
  const blob = new Blob([buf]);
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const scale = longSide / Math.max(bitmap.width, bitmap.height);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not draw the photo');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas;
}

export function cropFrac(src: OffscreenCanvas, x: number, y: number, w: number, h: number): OffscreenCanvas {
  const left = Math.min(src.width - 8, Math.round(x * src.width));
  const top = Math.min(src.height - 8, Math.round(y * src.height));
  const width = Math.max(8, Math.min(src.width - left, Math.round(w * src.width)));
  const height = Math.max(8, Math.min(src.height - top, Math.round(h * src.height)));
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not crop the photo');
  ctx.drawImage(src, left, top, width, height, 0, 0, width, height);
  return canvas;
}

export function resizeWidth(src: OffscreenCanvas, width: number): OffscreenCanvas {
  const height = Math.max(1, Math.round(src.height * (width / src.width)));
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not resize the photo');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, width, height);
  return canvas;
}

export function canvasPixels(canvas: OffscreenCanvas): ImageData {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not read the photo');
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function grayFromRgba(data: Uint8ClampedArray): Uint8Array {
  const n = data.length / 4;
  const g = new Uint8Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    g[i] = (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8;
  }
  return g;
}

/** Local-contrast binarisation. Ink is darker or brighter than a Gaussian neighbourhood by `off`. */
export function adaptiveBinarize(
  cv: CvLike,
  src: OffscreenCanvas,
  sigma: number,
  off: number,
  polarity: 'dark' | 'bright',
): OffscreenCanvas {
  const img = canvasPixels(src);
  const gray = grayFromRgba(img.data);
  const gmat = new cv.Mat(src.height, src.width, cv.CV_8UC1);
  gmat.data.set(gray);
  const blur = new cv.Mat();
  try {
    cv.GaussianBlur(gmat, blur, new cv.Size(0, 0), sigma, 0, cv.BORDER_DEFAULT);
    const w = src.width;
    const h = src.height;
    const bin = new Uint8Array(w * h);
    const bright = polarity === 'bright';
    for (let i = 0; i < bin.length; i++) {
      const d = gmat.data[i] - blur.data[i];
      const ink = bright ? d > off : d < -off;
      bin[i] = ink ? 0 : 255;
    }
    const padded = new OffscreenCanvas(w + 40, h + 40);
    const ctx = padded.getContext('2d');
    if (!ctx) throw new Error('Could not prepare text');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, padded.width, padded.height);
    const id = ctx.createImageData(w, h);
    for (let i = 0; i < bin.length; i++) {
      const v = bin[i];
      id.data[i * 4] = v;
      id.data[i * 4 + 1] = v;
      id.data[i * 4 + 2] = v;
      id.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(id, 20, 20);
    return padded;
  } finally {
    gmat.delete();
    blur.delete();
  }
}

export async function canvasToBlob(canvas: OffscreenCanvas, type = 'image/jpeg', quality = 0.92): Promise<Blob> {
  const blob = await canvas.convertToBlob({ type, quality });
  return blob;
}

export interface CvLike {
  // OpenCV output mats are constructed with no arguments.
  Mat: new (...args: unknown[]) => CvMat;
  CV_8UC1: number;
  CV_8UC4: number;
  Size: new (w: number, h: number) => unknown;
  GaussianBlur: (...args: unknown[]) => void;
  BORDER_DEFAULT: number;
  [key: string]: unknown;
}

export interface CvMat {
  data: Uint8Array;
  data32S: Int32Array;
  rows: number;
  delete: () => void;
}

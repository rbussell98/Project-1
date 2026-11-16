import fs from 'node:fs';
import { expect, test } from 'vitest';
import { MODEL, matchPath } from '../src/matcher/model';
import { openIndex } from '../src/matcher/popindex';

test('public matcher files are addressed with the Vite base', () => {
  const src = fs.readFileSync('src/matcher/worker.ts', 'utf8');
  expect(src).toContain('import.meta.env.BASE_URL');
  expect(src).not.toMatch(/fetch\(\s*['"`]\//);
  expect(src).not.toMatch(/new URL\(\s*['"`]\//);
  for (const asset of ['opencv/opencv.js', 'index/big-meta.json', 'index/big-int8.bin', 'index/model.json', 'ort/ort-wasm-simd-threaded.wasm', 'tesseract/worker.min.js', 'zxing/']) {
    expect(src).toContain(asset);
  }
});

test('visual match waits until the image model is ready', () => {
  expect(matchPath('ready')).toBe('visual');
  expect(matchPath('idle')).toBe('text');
  expect(matchPath('loading')).toBe('text');
  expect(matchPath('error')).toBe('text');
});

test('shipped index was built with the embedder the app loads', () => {
  const shipped = JSON.parse(fs.readFileSync('public/index/model.json', 'utf8')) as {
    id: string;
    dtype: string;
    dim: number;
    imageSize: number;
  };
  expect(shipped.id).toBe(MODEL.id);
  expect(shipped.dtype).toBe(MODEL.dtype);
  expect(shipped.dim).toBe(MODEL.dim);
  expect(shipped.imageSize).toBe(MODEL.imageSize);
});

test('index search reads its width from the buffer', () => {
  const meta: [string, string, string][] = [
    ['a', 'Artist', 'One'],
    ['b', 'Artist', 'Two'],
  ];
  const bin = new Int8Array([127, 0, 0, 0, 0, 127, 0, 0]);
  const idx = openIndex(meta, bin.buffer);
  expect(idx.n).toBe(2);
  const hits = idx.search(new Float32Array([1, 0, 0, 0]), 2);
  expect(hits[0]?.rgid).toBe('a');
  expect(hits[0]?.sim).toBeCloseTo(1, 5);
  expect(idx.vec(1)[1]).toBeCloseTo(1, 5);
});

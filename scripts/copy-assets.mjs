// Copy locally hosted runtime files into public/ so the phone never needs a CDN
// for OpenCV, Tesseract, or the ONNX runtime. The CLIP weights still download once.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const nm = path.join(root, 'node_modules');

function copy(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest) && fs.statSync(dest).size === fs.statSync(src).size) return;
  fs.copyFileSync(src, dest);
  console.log('copied', path.relative(root, dest));
}

async function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url} failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  console.log('downloaded', path.relative(root, dest), buf.length);
}

if (!fs.existsSync(nm)) {
  console.log('node_modules missing, skip asset copy');
  process.exit(0);
}

copy(
  path.join(nm, 'onnxruntime-web/dist/ort-wasm-simd-threaded.wasm'),
  path.join(root, 'public/ort/ort-wasm-simd-threaded.wasm'),
);
copy(
  path.join(nm, 'onnxruntime-web/dist/ort-wasm-simd-threaded.mjs'),
  path.join(root, 'public/ort/ort-wasm-simd-threaded.mjs'),
);
copy(path.join(nm, 'tesseract.js/dist/worker.min.js'), path.join(root, 'public/tesseract/worker.min.js'));
copy(
  path.join(nm, 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js'),
  path.join(root, 'public/tesseract/tesseract-core-simd-lstm.wasm.js'),
);
copy(
  path.join(nm, 'tesseract.js-core/tesseract-core-simd-lstm.wasm'),
  path.join(root, 'public/tesseract/tesseract-core-simd-lstm.wasm'),
);
copy(path.join(nm, '@techstark/opencv-js/dist/opencv.js'), path.join(root, 'public/opencv/opencv.js'));
copy(
  path.join(nm, 'zxing-wasm/dist/reader/zxing_reader.wasm'),
  path.join(root, 'public/zxing/zxing_reader.wasm'),
);

await download(
  'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz',
  path.join(root, 'public/tesseract/eng.traineddata.gz'),
);

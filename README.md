# Sleeve

Sleeve is Ryan Bussell's personal vinyl shelf. It lives on the phone: collection, wishlist, and add-by-photo. Nothing is uploaded. There is no account and no API key.

The shelf is dark by default (espresso, walnut, cream, amber). Titles are Fraunces. The rest of the interface uses the system font, the same way an iPhone app does.

## Run it

```bash
npm install
npm run dev -- --host
```

On this computer, open http://localhost:5173.

On an iPhone, join the same Wi-Fi and open `http://<this-computer-LAN-IP>:5173` in Safari. The dev server prints the Network address when it starts. Add by photo uses a normal file input (`accept="image/*" capture="environment"`), so the camera and photo library work over plain HTTP on the LAN.

**Add to Home Screen as a full-screen app needs HTTPS.** This repo does not enable hosting. A later step, only if Ryan says yes, would put the built `dist/` behind HTTPS. Until then, Safari on the LAN is the way to use it.

```bash
npm test
npm run build
npm run preview -- --host
```

`npm test` runs the unit tests and the Jack Johnson fast-path check. The first run downloads the CLIP vision model (about 88 MB) into `.cache/clip`. Later runs reuse it.

## What stays on the device

Records, covers, the MusicBrainz cache, and embeddings of covers you save are in IndexedDB (`sleeve`). Settings can export and import a JSON backup, covers included as data URLs.

The first time you add a photo, the app downloads `Xenova/clip-vit-base-patch32` (quantized, about 88 MB) and keeps it in the browser cache. A progress bar shows that download. If the model cannot load, Sleeve falls back to reading the sleeve and searching MusicBrainz. It never saves a record until you tap Save.

## Add by photo

The matcher is the one measured in `matcher/RESULTS.md`. It is ported, not redesigned.

1. Find the sleeve (OpenCV, loaded only when a photo is added).
2. Embed the cover with CLIP and search the shipped index of about 9,600 albums.
3. If the best cosine is at least 0.90 and beats the next album by at least 0.06, stop. No OCR, no MusicBrainz.
4. Otherwise read the type (Tesseract, files hosted in `public/tesseract`) and search MusicBrainz one request at a time, at least 1.1 seconds apart. Responses are cached in IndexedDB.
5. Rank by cosine plus a small text bonus and show the top three.

In development, Vite proxies `musicbrainz.org` and `coverartarchive.org` and sets `User-Agent: Sleeve/1.0 (rbussell98@gmail.com)`. A production build calls those hosts directly. Browsers cannot set that header themselves. Both services currently send `Access-Control-Allow-Origin: *`.

## Large files

| File | What it is |
| --- | --- |
| `public/index/big-int8.bin` | 9,612 × 512 int8 CLIP vectors, about 4.7 MB |
| `public/index/big-meta.json` | release-group id, artist, title |
| `public/opencv/opencv.js` | cover detection, loaded on demand |
| `public/ort/` | ONNX Runtime wasm for the image model |
| `public/tesseract/` | worker, core, and `eng.traineddata.gz` |
| `.cache/clip/` | the vision model after the first download (not committed) |

`npm install` copies the runtime files out of `node_modules` into `public/` (`scripts/copy-assets.mjs`).

### Rebuild the index

The index is ListenBrainz's public sitewide charts plus MusicBrainz studio albums, embedded offline. From this repo, with a network connection and a few hours:

```bash
cd matcher
node eval/buildindex.mjs
node eval/buildindex2.mjs
cp index/big-int8.bin index/big-meta.json ../public/index/
```

`buildindex.mjs` writes the ListenBrainz slice. `buildindex2.mjs` extends it. Re-run occasionally. The scripts talk to ListenBrainz, MusicBrainz, and the Cover Art Archive. No key.

To score the pipeline again:

```bash
node matcher/eval/run.mjs real
```

The real photo used by the test is `eval/real/jj_moonlight_screenshot.jpg` (Jack Johnson, *Meet the Moonlight*). Mild and harsh photo sets from the original eval are not in this repo.

## Layout

- `src/` the iPhone app
- `src/matcher/worker.ts` the browser port of the pipeline, in a worker
- `matcher/src/` the Node pipeline the tests and eval scripts run
- `public/index/` the visual index

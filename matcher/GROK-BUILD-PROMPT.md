# Prompt for Grok Build: free automatic "Add by photo" for Sleeve

Replace the current whole-image Tesseract flow with the pipeline below. It is free: no API keys, no paid or hosted AI. It was built and tested in Node with the same libraries that run in the browser (see /workspace/sleeve-matcher/src). Port it, do not redesign it.

KEY IDEA: identify by IMAGE similarity, not by text. OCR only suggests search terms.

LIBRARIES (all free, all run in the browser):
- onnxruntime-web via @huggingface/transformers (transformers.js), model `Xenova/clip-vit-base-patch32`, vision tower only (CLIPVisionModelWithProjection, dtype q8, about 88 MB, download once and cache with the browser Cache API; show "Downloading image model, one time only" progress).
- tesseract.js (host worker, core and eng.traineddata locally, not from a CDN), 2 to 4 workers.
- @techstark/opencv-js (about 13 MB, lazy-load only when a photo is added) for cover detection.
- zxing-wasm (barcode).
- No server needed except an optional tiny pass-through proxy if a browser blocks MusicBrainz or CAA (both currently send CORS "*").

DATA SHIPPED WITH THE APP (static files, built offline by script):
- `index/big-int8.bin` (N x 512 int8) and `index/big-meta.json` ([[rgid, artist, title], ...]) = visual index of about 9,600 popular albums. Build script: eval/buildindex.mjs then eval/buildindex2.mjs (ListenBrainz public sitewide top release groups + top 500 artists, MusicBrainz studio albums, CAA 250px, CLIP embedding, int8 = round(v*127) of the L2-normalised vector). 5 MB + 0.8 MB. Rebuild occasionally. Also append every record the user adds (embedding of the official cover) to a local IndexedDB index and search it too.

EMBEDDING RECIPE (identical for photo, thumbnails, and index): resize the image to 224x224 with NO centre crop (squash), RGB, CLIP mean/std normalisation, run the vision model, take image_embeds, L2-normalise. Similarity = dot product.

ALGORITHM (per photo; times are from the Node test, warm cache):
0. Load the photo, apply EXIF rotation, resize long side to 1600 px.
1. Cover detection (opencv.js, about 0.1 s): work on a 640 px copy. Run Canny with 4 threshold pairs [0.33*median, 0.66*median+20], [20,60], [10,30], [40,110] on the blurred grey image, plus Canny(15,45) on each of R, G, B. Dilate and close with a 5x5 kernel, findContours, convex hull, approxPolyDP with epsilon 0.02, 0.035, 0.055 of the perimeter. Keep convex 4-point quads with area 8% to 97% of the image, aspect ratio 0.55 to 1.8, hull area / quad area > 0.8. Score = area * (0.4 if a corner touches the image border) * fill * (1 - 0.3*min(1,|ln aspect|)). Warp the best quad from the full-resolution photo to a 1024x1024 square. If none is found, continue with the whole photo. This raised the mean photo-to-cover cosine from 0.72 to 0.90.
2. Embed: the flattened cover, the whole photo, and centre crops at 84% and 64%. A candidate's similarity is the MAX over these 4 embeddings.
3. Barcode (zxing-wasm, formats EAN-13/UPC-A/UPC-E/EAN-8, tryHarder, tryRotate, tryInvert) on the whole photo and a contrast-normalised copy. If found: MusicBrainz `release?query=barcode:CODE&fmt=json`; those release groups become candidates with priority.
4. FAST PATH (no OCR, no network): search the visual index with the top 2 embeddings (brute force dot product, 9.6k x 512, under 50 ms). If the best cosine >= 0.90 and it beats the second-best album by >= 0.06, accept it. About 1.5 s total. This is what handles text-free covers (Dark Side of the Moon, Abbey Road, Blonde) and stylised covers.
5. OCR (only if the fast path did not accept). Run on the flattened cover, upscaled to 1800 px wide. Local-contrast binarisation: ink = pixel darker (polarity "dark") or brighter ("bright") than its Gaussian-blurred neighbourhood by `off` grey levels, with (sigma, off) in {(25,12), (50,8)}; pad 20 px white. tesseract PSM 11 (sparse text), `user_defined_dpi=300`, request blocks output. Round 1 = whole cover, 2 polarities x 2 settings = 4 passes. If no "solid" phrase (best score >= 100 and (>= 8 characters or >= 2 phrases)), round 2 adds the top half and bottom half crops (8 passes), and if still nothing, round 3 runs the whole photo. Plain greyscale and PSM 3 passes were tested and add almost nothing; do not use them. This is the step that fixed "JACK JOHNSON" on a gray sky (global thresholding and whole-image reading returned garbage).
   Keep only real-word lines: at least 4 letters, letters >= 75% of non-space characters, line confidence >= 60, no 1-character junk, every word has a vowel or digit. Score = confidence * (1 + log2(times seen across passes)) * min(1, 0.4 + length/14). Keep the best 8.
6. Candidate generation from MusicBrainz (strictly serial, at least 1.1 s between request starts, User-Agent `Sleeve/1.0 (rbussell98@gmail.com)` set on the server or proxy because browsers cannot set it, retry once after 3 s on 503, cache every response in IndexedDB):
   a. One combined query: `(artist:"P" OR releasegroup:"P" OR ...)` over the top 5 phrases, `AND (primarytype:album OR primarytype:ep)`, limit 100.
   b. If at least 2 word fragments of 4+ letters: `releasegroup:(w1~ AND w2~ ...)` (fuzzy AND, catches "Maide"+"oyage"+"Voyage").
   c. Artist expansion: pick the artist whose name matches the OCR words (local text score >= 0.75) and fetch `arid:ID AND primarytype:album AND -secondarytype:compilation AND -secondarytype:remix AND -secondarytype:dj-mix AND -secondarytype:mixtape/street AND -secondarytype:demo AND -secondarytype:spokenword`, limit 100 (includes live albums).
   d. Only if the best match is not confident: up to 2 single-word fuzzy queries `(artist:w~ OR releasegroup:w~)` plus one more artist expansion.
   Rank the pool locally by fuzzy text match (token Levenshtein <= 1 for words of 4+ letters, <= 2 for 8+, partial prefix/suffix 0.6, artist and title averaged), embed at most the best 40 not already in the visual index (CAA `https://coverartarchive.org/release-group/{id}/front-250`, 10 parallel, skip 404s). Candidates that are already in the visual index reuse the stored vector, no download.
7. Final ranking over (pool candidates + top 8 visual-index neighbours): score = cosine + 0.15 * textMatch. Return the top 3.
8. Confidence: AUTO-ACCEPT (jump to the confirm screen) only when top cosine >= 0.80 and score margin over the runner-up >= 0.04. Otherwise show the top 3 as cards with covers ("Which one is it?") plus the editable Artist/Album fields and "Use my photo as the cover". Never show junk lists.
9. Status steps shown to the user: "Finding the cover", "Matching the artwork", "Reading text", "Searching MusicBrainz (n of m)", "Found: Artist - Album". Show real errors. Never call MusicBrainz more than once per second, one at a time.

BROWSER vs SERVER:
- Browser: everything above (OpenCV, OCR, CLIP, barcode, index search, ranking).
- Server (small function, optional): a pass-through for musicbrainz.org and coverartarchive.org that adds the User-Agent and a 24 h cache. No keys.

MEASURED ACCURACY (RESULTS.md): mild phone photos top-1 73% (22/30), top-3 80%; harsh (low-res, glare, 12 degree tilt) top-1 57%, top-3 60%; the two real Jack Johnson photos 2/2. 25 of 30 test albums are in the visual index, so this is optimistic for obscure albums. Known limits: it identifies the album when the CAA front image for that release group looks like the user's copy. A different edition with different artwork (box sets, Japanese obi strips, vinyl-sleeve photos with other art) or an obscure album with unreadable text and not in the index will fall back to the "Which one is it?" cards or manual entry.

ACCEPTANCE TESTS TO ADD: the test harness in /workspace/sleeve-matcher/eval (30 covers x mild/harsh degradations plus the real Jack Johnson "Meet the Moonlight" phone screenshot, which must auto-match through the fast path in about 1.5 s at cosine 0.97).

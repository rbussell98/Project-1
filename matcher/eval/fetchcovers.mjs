import fs from 'node:fs';
import { caaFetch } from '../src/net.mjs';
const res = JSON.parse(fs.readFileSync(new URL('./resolved.json', import.meta.url)));
fs.mkdirSync(new URL('./src_covers/', import.meta.url), { recursive: true });
const meta = [];
for (const a of res) {
  const rgb = await caaFetch(`https://coverartarchive.org/release-group/${a.rgid}`);
  if (!rgb) { console.log('NO CAA for RG', a.artist, a.title); continue; }
  const rgj = JSON.parse(rgb.toString());
  const front = rgj.images.find((i) => i.front) || rgj.images[0];
  let alt = null;
  const rels = (a.releases || []).slice(0, 14);
  for (const rid of rels) {
    if (rgj.release.endsWith(rid)) continue;
    const b = await caaFetch(`https://coverartarchive.org/release/${rid}`);
    if (!b) continue;
    let j; try { j = JSON.parse(b.toString()); } catch { continue; }
    const f = j.images.find((i) => i.front);
    if (f && f.id !== front.id) { alt = { rid, img: f }; break; }
  }
  const useAlt = !!alt;
  const img = useAlt ? alt.img : front;
  const url = img.thumbnails['500'] || img.thumbnails.large;
  const buf = await caaFetch(url.replace('http://', 'https://'));
  if (!buf) { console.log('download fail', a.title); continue; }
  const file = `eval/src_covers/${a.rgid}.jpg`;
  fs.writeFileSync(file, buf);
  meta.push({ ...a, file, differentEdition: useAlt, srcImageId: img.id, rgFrontId: front.id });
  console.log(a.artist, '-', a.title, useAlt ? 'ALT-EDITION' : 'same-edition', buf.length);
}
fs.writeFileSync('eval/dataset.json', JSON.stringify(meta, null, 1));

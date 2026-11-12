import fs from 'node:fs';
import { goodLines } from '../src/ocr.mjs';
import { ocrWordSet, textScore } from '../src/textmatch.mjs';
const ds = JSON.parse(fs.readFileSync('eval/dataset.json'));
const truth = Object.fromEntries(ds.map((d) => [d.rgid, { artist: d.mbArtist, title: d.mbTitle }]));
truth.real_moonlight = { artist: 'Jack Johnson', title: 'Meet the Moonlight' }; truth.real_ibd = { artist: 'Jack Johnson', title: 'In Between Dreams' };
const files = fs.readdirSync('cache/rawocr').filter((f) => f.endsWith('.json'));
const data = files.map((f) => ({ id: f.replace('.json', ''), ...JSON.parse(fs.readFileSync('cache/rawocr/' + f)) }));
console.log('photos', data.length);
const key = (id) => id.replace(/_(mild|harsh)$/, '');
function hit(lines, id) {
  const g = goodLines(lines).slice(0, 8);
  const w = ocrWordSet(g);
  const s = textScore(truth[key(id)], w);
  return { artist: s.artist >= 0.75, title: s.title >= 0.75, any: s.artist >= 0.75 || s.title >= 0.75, strong: s.artist >= 0.75 && s.title >= 0.75 };
}
const subsets = {
  'crop all': (d) => d.crop || [],
  'whole all': (d) => d.whole,
  'crop+whole all': (d) => [...(d.crop || []), ...d.whole],
  'crop psm11 only': (d) => (d.crop || []).filter((l) => l.tag.endsWith('psm11')),
  'crop psm3 only': (d) => (d.crop || []).filter((l) => l.tag.endsWith('psm3')),
  'crop whole-region only': (d) => (d.crop || []).filter((l) => l.tag.startsWith('whole')),
  'crop top+bottom only': (d) => (d.crop || []).filter((l) => !l.tag.startsWith('whole')),
  'crop adaptive only': (d) => (d.crop || []).filter((l) => /s25|s50/.test(l.tag)),
  'crop grey only': (d) => (d.crop || []).filter((l) => /grey/.test(l.tag)),
  'crop dark only': (d) => (d.crop || []).filter((l) => /dark|grey\//.test(l.tag)),
  'crop s25 only': (d) => (d.crop || []).filter((l) => /s25|grey/.test(l.tag)),
  'crop (whole region, all variants)': (d) => (d.crop || []).filter((l) => l.tag.startsWith('whole')),
};
for (const [name, f] of Object.entries(subsets)) {
  const rows = data.filter((d) => !d.id.startsWith('real')).map((d) => hit(f(d), d.id));
  const n = rows.length; const c = (k) => rows.filter((r) => r[k]).length;
  console.log(name.padEnd(36), `artist ${c('artist')}/${n}  title ${c('title')}/${n}  any ${c('any')}/${n} both ${c('strong')}/${n}`);
}
// per-photo detail for crop+whole
for (const d of data) { const h = hit([...(d.crop || []), ...d.whole], d.id); console.log(d.id.slice(0, 8), d.id.endsWith('harsh') ? 'harsh' : d.id.endsWith('mild') ? 'mild ' : 'real ', 'crop?', !!d.crop, JSON.stringify(h)); }

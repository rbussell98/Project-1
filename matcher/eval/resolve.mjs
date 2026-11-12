import fs from 'node:fs';
import { mbJson, caaFetch } from '../src/net.mjs';
const albums = JSON.parse(fs.readFileSync(new URL('./albums.json', import.meta.url)));
const out = [];
for (const [artist, title, style] of albums) {
  const q = encodeURIComponent(`releasegroup:"${title}" AND artist:"${artist}" AND primarytype:album`);
  const j = await mbJson(`https://musicbrainz.org/ws/2/release-group?query=${q}&fmt=json&limit=5`);
  const rgs = (j['release-groups'] || []);
  const rg = rgs[0];
  if (!rg) { console.log('NOT FOUND', artist, title); continue; }
  out.push({ artist, title, style, rgid: rg.id, mbTitle: rg.title, mbArtist: rg['artist-credit'].map(a=>a.name+(a.joinphrase||'')).join(''), releases: (rg.releases||[]).map(r=>r.id).slice(0,40) });
  console.log(artist, '|', title, '=>', rg.id, rg.title, rg.score);
}
fs.writeFileSync(new URL('./resolved.json', import.meta.url), JSON.stringify(out, null, 1));

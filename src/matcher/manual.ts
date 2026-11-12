import type { DraftCandidate } from '../types';
import { caaBase, caaFetchBlob, mbBase, mbJson } from './net';

function esc(s: string) {
  return s.replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function yearFromDate(date: unknown): number | null {
  if (typeof date !== 'string' || date.length < 4) return null;
  const y = parseInt(date.slice(0, 4), 10);
  return Number.isFinite(y) && y > 1800 && y < 2200 ? y : null;
}

type Rg = {
  id: string;
  title?: string;
  'first-release-date'?: string;
  'artist-credit'?: { name?: string; joinphrase?: string }[];
};

function artistOf(rg: Rg): string {
  return (rg['artist-credit'] || []).map((a) => (a.name || '') + (a.joinphrase || '')).join('').trim();
}

export async function searchByName(artist: string, album: string): Promise<DraftCandidate[]> {
  const parts: string[] = [];
  if (artist.trim()) parts.push(`artist:"${esc(artist)}"`);
  if (album.trim()) parts.push(`releasegroup:"${esc(album)}"`);
  if (!parts.length) return [];
  const q = `${parts.join(' AND ')} AND (primarytype:album OR primarytype:ep)`;
  const j = await mbJson(`${mbBase()}/ws/2/release-group?query=${encodeURIComponent(q)}&limit=8&fmt=json`);
  const rows = (j?.['release-groups'] as Rg[]) || [];
  return rows.map((rg) => ({
    rgid: rg.id,
    artist: artistOf(rg) || artist.trim(),
    title: rg.title || album.trim(),
    year: yearFromDate(rg['first-release-date']),
    label: '',
    sim: null,
    score: null,
  }));
}

export async function enrichRelease(rgid: string): Promise<{ year: number | null; label: string }> {
  const rg = await mbJson(`${mbBase()}/ws/2/release-group/${rgid}?fmt=json`);
  const year = yearFromDate(rg?.['first-release-date']);
  let label = '';
  try {
    const rel = await mbJson(`${mbBase()}/ws/2/release?release-group=${rgid}&inc=labels&fmt=json&limit=5`);
    const releases = (rel?.releases as { 'label-info'?: { label?: { name?: string } }[] }[]) || [];
    for (const r of releases) {
      const name = r['label-info']?.[0]?.label?.name;
      if (name && name !== '[no label]') {
        label = name;
        break;
      }
    }
  } catch {
    /* label is optional */
  }
  return { year, label };
}

export function coverUrl(rgid: string): string {
  return `${caaBase()}/release-group/${rgid}/front-250`;
}

export function fetchCover(rgid: string): Promise<Blob | null> {
  return caaFetchBlob(coverUrl(rgid));
}

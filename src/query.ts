import type { SleeveRecord, SortKey } from './types';

export function filterRecords(records: SleeveRecord[], q: string): SleeveRecord[] {
  const s = q.trim().toLowerCase();
  if (!s) return records;
  return records.filter((r) => {
    if (r.artist.toLowerCase().includes(s)) return true;
    if (r.title.toLowerCase().includes(s)) return true;
    if ((r.label || '').toLowerCase().includes(s)) return true;
    if (r.year != null && String(r.year).includes(s)) return true;
    return false;
  });
}

function cmpText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

export function sortRecords(records: SleeveRecord[], key: SortKey): SleeveRecord[] {
  const rows = [...records];
  rows.sort((a, b) => {
    if (key === 'artist') return cmpText(a.artist, b.artist) || cmpText(a.title, b.title);
    if (key === 'title') return cmpText(a.title, b.title) || cmpText(a.artist, b.artist);
    if (key === 'year') {
      const ay = a.year ?? -1;
      const by = b.year ?? -1;
      return by - ay || cmpText(a.artist, b.artist);
    }
    return b.addedAt - a.addedAt || cmpText(a.artist, b.artist);
  });
  return rows;
}

import { useState } from 'react';
import { searchByName } from '../matcher/manual';
import type { DraftCandidate } from '../types';
import { Sheet } from './chrome';

export function ManualSheet({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (candidates: DraftCandidate[], artist: string, album: string) => void;
}) {
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<DraftCandidate[] | null>(null);

  async function search() {
    setBusy(true);
    setError('');
    try {
      const found = await searchByName(artist, album);
      setRows(found);
      if (!found.length) setError('Nothing under that name. You can still type it in and save.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MusicBrainz did not answer.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title="Search" onClose={onClose} testId="manual-sheet">
      <label className="field">
        <span>Artist</span>
        <input value={artist} onChange={(e) => setArtist(e.target.value)} aria-label="Search artist" />
      </label>
      <label className="field">
        <span>Album</span>
        <input value={album} onChange={(e) => setAlbum(e.target.value)} aria-label="Search album" />
      </label>
      <div className="btn-row">
        <button className="btn primary block" disabled={busy || (!artist.trim() && !album.trim())} onClick={() => void search()}>
          {busy ? 'Searching MusicBrainz (1 of 1)' : 'Search'}
        </button>
      </div>
      {error ? <p className="err">{error}</p> : null}
      {rows && (
        <div className="group">
          {rows.map((r, i) => (
            <button
              key={r.rgid || r.title}
              className="row"
              onClick={() => onPick([r, ...rows.filter((_, j) => j !== i)].slice(0, 3), artist, album)}
            >
              <span className="label">
                {r.title}
                <span className="hint" style={{ display: 'block' }}>
                  {r.artist}
                  {r.year ? ` · ${r.year}` : ''}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      {rows && rows.length === 0 && (
        <div className="btn-row">
          <button className="btn ghost block" onClick={() => onPick([], artist, album)}>
            Save what I typed
          </button>
        </div>
      )}
    </Sheet>
  );
}

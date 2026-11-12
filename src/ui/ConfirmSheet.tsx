import { useEffect, useState } from 'react';
import { enrichRelease, fetchCover } from '../matcher/manual';
import type { Draft, DraftCandidate, Shelf } from '../types';
import { Sheet } from './chrome';
import { Disc } from './icons';

export function ConfirmSheet({
  draft,
  onChange,
  onClose,
  onSave,
  onResearch,
  busy,
}: {
  draft: Draft;
  onChange: (recipe: (d: Draft) => Draft) => void;
  onClose: () => void;
  onSave: () => void;
  onResearch: (artist: string, album: string) => void;
  busy: boolean;
}) {
  const selected = draft.candidates[draft.selected] || draft.candidates[0];
  const [covers, setCovers] = useState<Record<string, string>>({});
  const artist = selected?.artist || '';
  const title = selected?.title || '';

  const coverKey = draft.candidates.map((c) => c.rgid || '').join('|');
  useEffect(() => {
    let cancel = false;
    const created: string[] = [];
    const ids = coverKey.split('|').filter(Boolean);
    void (async () => {
      await Promise.all(
        ids.map(async (id) => {
          const blob = await fetchCover(id);
          if (cancel || !blob) return;
          const url = URL.createObjectURL(blob);
          created.push(url);
          setCovers((m) => ({ ...m, [id]: url }));
        }),
      );
    })();
    return () => {
      cancel = true;
      for (const u of created) URL.revokeObjectURL(u);
    };
  }, [coverKey]);

  useEffect(() => {
    const c = draft.candidates[draft.selected];
    if (!c?.rgid || (c.year && c.label)) return;
    let cancel = false;
    void enrichRelease(c.rgid).then((info) => {
      if (cancel) return;
      onChange((d) => ({
        ...d,
        candidates: d.candidates.map((row, i) =>
          i === d.selected ? { ...row, year: row.year ?? info.year, label: row.label || info.label } : row,
        ),
      }));
    });
    return () => {
      cancel = true;
    };
    // Enrich once per selected release group. draft is read fresh inside the effect via the selected id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.selected, selected?.rgid]);

  function patch(partial: Partial<DraftCandidate>) {
    onChange((d) => ({
      ...d,
      candidates: d.candidates.map((row, i) => (i === d.selected ? { ...row, ...partial } : row)),
    }));
  }

  const showPick = draft.candidates.filter((c) => c.title || c.artist).length > 1;
  const hero = draft.usePhoto && draft.photoUrl ? draft.photoUrl : (selected?.rgid && covers[selected.rgid]) || draft.photoUrl;

  return (
    <Sheet onClose={onClose} testId="confirm-sheet">
      {hero ? <img className="hero" src={hero} alt="" data-testid="confirm-cover" /> : <Disc className="hero ph" />}
      <p className="kicker">{artist || 'Unknown artist'}</p>
      <h2 className="album" data-testid="confirm-title">
        {title || 'Untitled'}
      </h2>
      <p className="year">{selected?.year || 'Year unknown'}</p>
      <div className="seg" role="group" aria-label="Shelf">
        {(['collection', 'wishlist'] as Shelf[]).map((shelf) => (
          <button
            key={shelf}
            className={draft.list === shelf ? (shelf === 'wishlist' ? 'on wish' : 'on') : undefined}
            onClick={() => onChange((d) => ({ ...d, list: shelf }))}
          >
            {shelf === 'collection' ? 'Collection' : 'Wishlist'}
          </button>
        ))}
      </div>
      {showPick && (
        <>
          <h3 className="which">Which one is it?</h3>
          <div className="picks">
            {draft.candidates.slice(0, 3).map((c, i) => (
              <button
                key={(c.rgid || 'local') + i}
                className={i === draft.selected ? 'pick on' : 'pick'}
                onClick={() => onChange((d) => ({ ...d, selected: i }))}
              >
                {c.rgid && covers[c.rgid] ? <img src={covers[c.rgid]} alt="" /> : <Disc />}
                <div className="t">{c.title || 'Untitled'}</div>
                <div className="a">{c.artist}</div>
              </button>
            ))}
          </div>
        </>
      )}
      {!draft.confident && draft.candidates.length > 0 && !showPick ? null : null}
      <label className="field">
        <span>Artist</span>
        <input value={artist} onChange={(e) => patch({ artist: e.target.value })} aria-label="Artist" />
      </label>
      <label className="field">
        <span>Album</span>
        <input value={title} onChange={(e) => patch({ title: e.target.value })} aria-label="Album" />
      </label>
      <div className="btn-row">
        <button className="btn ghost block" disabled={busy} onClick={() => onResearch(artist, title)}>
          {busy ? 'Searching…' : 'Search again'}
        </button>
        {draft.photoBlob && (
          <button className="btn ghost block" onClick={() => onChange((d) => ({ ...d, usePhoto: !d.usePhoto }))}>
            {draft.usePhoto ? 'Use the catalog cover' : 'Use my photo as the cover'}
          </button>
        )}
        <button className="btn primary block" data-testid="save-record" disabled={!artist.trim() || !title.trim()} onClick={onSave}>
          Save
        </button>
        <button className="btn ghost block" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Sheet>
  );
}

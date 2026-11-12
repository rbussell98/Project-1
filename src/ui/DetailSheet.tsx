import { useState } from 'react';
import type { SleeveRecord } from '../types';
import { CoverImg, Sheet } from './chrome';

export function DetailSheet({
  record,
  onClose,
  onSave,
  onMove,
  onDelete,
}: {
  record: SleeveRecord;
  onClose: () => void;
  onSave: (next: SleeveRecord) => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(record);

  function set<K extends keyof SleeveRecord>(key: K, value: SleeveRecord[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <Sheet onClose={onClose} testId="detail-sheet">
      <CoverImg blob={record.cover} className="hero" alt="" />
      {editing ? (
        <>
          <label className="field">
            <span>Artist</span>
            <input value={form.artist} onChange={(e) => set('artist', e.target.value)} />
          </label>
          <label className="field">
            <span>Title</span>
            <input value={form.title} onChange={(e) => set('title', e.target.value)} />
          </label>
          <label className="field">
            <span>Year</span>
            <input
              inputMode="numeric"
              value={form.year ?? ''}
              onChange={(e) => set('year', e.target.value ? Number(e.target.value) : null)}
            />
          </label>
          <label className="field">
            <span>Label</span>
            <input value={form.label} onChange={(e) => set('label', e.target.value)} />
          </label>
          <label className="field">
            <span>Format</span>
            <input value={form.format} onChange={(e) => set('format', e.target.value)} />
          </label>
          <label className="field">
            <span>Notes</span>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </label>
          <div className="btn-row">
            <button
              className="btn primary block"
              disabled={!form.artist.trim() || !form.title.trim()}
              onClick={() => {
                onSave({ ...form, artist: form.artist.trim(), title: form.title.trim(), updatedAt: Date.now() });
                setEditing(false);
              }}
            >
              Save changes
            </button>
            <button
              className="btn ghost block"
              onClick={() => {
                setForm(record);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="kicker">{record.artist}</p>
          <h2 className="album">{record.title}</h2>
          <p className="year">{record.year || 'Year unknown'}</p>
          <div className="group">
            <div className="row">
              <span className="label">Label</span>
              <span className="hint">{record.label || '—'}</span>
            </div>
            <div className="row">
              <span className="label">Format</span>
              <span className="hint">{record.format || '—'}</span>
            </div>
            <div className="row notes">
              <span className="label">Notes</span>
              <span className="hint">{record.notes || '—'}</span>
            </div>
            {record.rgid && (
              <a className="row" href={`https://musicbrainz.org/release-group/${record.rgid}`} target="_blank" rel="noreferrer">
                <span className="label">MusicBrainz</span>
                <span className="hint">Open</span>
              </a>
            )}
          </div>
          <div className="btn-row">
            <button className="btn primary block" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button className={record.list === 'collection' ? 'btn teal block' : 'btn primary block'} onClick={onMove}>
              {record.list === 'collection' ? 'Move to Wishlist' : 'Move to Collection'}
            </button>
            <button className="btn danger block" onClick={onDelete}>
              Delete
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

export function DeleteSheet({ title, onClose, onConfirm }: { title: string; onClose: () => void; onConfirm: () => void }) {
  return (
    <Sheet title="Take this off the shelf?" onClose={onClose} action testId="delete-sheet">
      <p className="fine" style={{ textAlign: 'center' }}>
        {title} will leave this phone.
      </p>
      <div className="btn-row">
        <button className="btn danger block" data-testid="confirm-delete" onClick={onConfirm}>
          Delete
        </button>
        <button className="btn ghost block" onClick={onClose}>
          Keep it
        </button>
      </div>
    </Sheet>
  );
}

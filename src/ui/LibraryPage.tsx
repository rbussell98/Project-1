import { useRef, useState, type ReactNode } from 'react';
import type { Shelf, SleeveRecord, SortKey, ViewMode } from '../types';
import { CoverImg, Screen, Sheet } from './chrome';
import { IconList, IconCollection, IconSearch, IconSort } from './icons';

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'artist', label: 'Artist' },
  { id: 'title', label: 'Title' },
  { id: 'year', label: 'Year' },
  { id: 'added', label: 'Date added' },
];

export function LibraryPage({
  title,
  shelf,
  records,
  query,
  onQuery,
  sort,
  onSort,
  view,
  onView,
  onOpen,
  onMove,
  onDelete,
  onAddPhoto,
  onSearch,
}: {
  title: string;
  shelf: Shelf;
  records: SleeveRecord[];
  query: string;
  onQuery: (q: string) => void;
  sort: SortKey;
  onSort: (s: SortKey) => void;
  view: ViewMode;
  onView: (v: ViewMode) => void;
  onOpen: (id: string) => void;
  onMove: (id: string) => void;
  onDelete: (id: string) => void;
  onAddPhoto: () => void;
  onSearch: () => void;
}) {
  const [sortOpen, setSortOpen] = useState(false);
  const empty = records.length === 0 && !query.trim();
  const count = query.trim()
    ? `${records.length} match${records.length === 1 ? '' : 'es'}`
    : records.length
      ? `${records.length} record${records.length === 1 ? '' : 's'}`
      : undefined;
  return (
    <Screen
      title={title}
      count={count}
      actions={
        <>
          <button className="icon-btn" aria-label="Sort" onClick={() => setSortOpen(true)}>
            <IconSort />
          </button>
          <button
            className="icon-btn"
            aria-label={view === 'grid' ? 'List view' : 'Grid view'}
            onClick={() => onView(view === 'grid' ? 'list' : 'grid')}
          >
            {view === 'grid' ? <IconList /> : <IconCollection />}
          </button>
        </>
      }
    >
      {!empty && (
        <label className="search">
          <IconSearch />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Artist, title, label, year"
            aria-label="Search records"
            data-testid="search"
          />
        </label>
      )}
      {empty ? (
        <div className="empty" data-testid={shelf === 'collection' ? 'empty-collection' : 'empty-wishlist'}>
          <h2>The room is quiet.</h2>
          <p>Put a record on. A photo of the sleeve is enough to start.</p>
          {shelf === 'collection' && (
            <div className="stack">
              <button className="btn primary block" onClick={onAddPhoto}>
                Add by photo
              </button>
              <button className="btn ghost block" onClick={onSearch}>
                Search MusicBrainz
              </button>
            </div>
          )}
        </div>
      ) : records.length === 0 ? (
        <p className="quiet">Nothing matches.</p>
      ) : view === 'grid' ? (
        <div className="grid" data-testid="record-grid">
          {records.map((r) => (
            <button key={r.id} className="cover-btn" onClick={() => onOpen(r.id)} data-testid="record-card">
              <CoverImg blob={r.cover} alt="" />
              <div className="t">{r.title}</div>
              <div className="a">{r.artist}</div>
            </button>
          ))}
        </div>
      ) : (
        <div className="list" data-testid="record-list">
          {records.map((r) => (
            <SwipeRow
              key={r.id}
              moveLabel={shelf === 'collection' ? 'Wishlist' : 'Collect'}
              onMove={() => onMove(r.id)}
              onDelete={() => onDelete(r.id)}
              onOpen={() => onOpen(r.id)}
            >
              <CoverImg blob={r.cover} className="thumb" alt="" />
              <div className="row-copy">
                <div className="t">{r.title}</div>
                <div className="a">{r.artist}</div>
                <div className="meta">{[r.year, r.label].filter(Boolean).join(' · ')}</div>
              </div>
            </SwipeRow>
          ))}
        </div>
      )}
      {sortOpen && (
        <Sheet title="Sort" onClose={() => setSortOpen(false)} action>
          <div className="group">
            {SORTS.map((s) => (
              <button
                key={s.id}
                className="row"
                onClick={() => {
                  onSort(s.id);
                  setSortOpen(false);
                }}
              >
                <span className="label">{s.label}</span>
                {sort === s.id ? <span className="check">✓</span> : null}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </Screen>
  );
}

function SwipeRow({
  children,
  moveLabel,
  onMove,
  onDelete,
  onOpen,
}: {
  children: ReactNode;
  moveLabel: string;
  onMove: () => void;
  onDelete: () => void;
  onOpen: () => void;
}) {
  const [x, setX] = useState(0);
  const start = useRef<{ x: number; y: number; base: number; lock: 'x' | 'y' | null } | null>(null);
  const moved = useRef(false);

  return (
    <div className="swipe">
      <div className="swipe-actions">
        <button
          className="move"
          onClick={() => {
            setX(0);
            onMove();
          }}
        >
          {moveLabel}
        </button>
        <button
          className="del"
          onClick={() => {
            setX(0);
            onDelete();
          }}
        >
          Delete
        </button>
      </div>
      <button
        className="row-main"
        style={{ transform: `translateX(${x}px)` }}
        onPointerDown={(e) => {
          start.current = { x: e.clientX, y: e.clientY, base: x, lock: null };
          moved.current = false;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          if (!s.lock) {
            if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
            s.lock = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
          }
          if (s.lock !== 'x') return;
          moved.current = true;
          setX(Math.max(-148, Math.min(0, s.base + dx)));
        }}
        onPointerUp={() => {
          const open = x < -64;
          setX(open ? -148 : 0);
          start.current = null;
        }}
        onClick={() => {
          if (moved.current) {
            moved.current = false;
            return;
          }
          if (x < -20) setX(0);
          else onOpen();
        }}
      >
        {children}
      </button>
    </div>
  );
}

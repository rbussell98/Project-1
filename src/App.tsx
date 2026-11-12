import { useEffect, useMemo, useRef, useState } from 'react';
import { deleteRecord, listRecords, newId, putRecord, subscribe } from './db';
import { cancelIdentify, identify, rememberCover } from './matcher/client';
import { fetchCover, searchByName } from './matcher/manual';
import { applyTheme, loadPrefs, savePrefs } from './prefs';
import { filterRecords, sortRecords } from './query';
import type { Draft, DraftCandidate, IdentifyResult, Shelf, SleeveRecord, TabId } from './types';
import { AddPage } from './ui/AddPage';
import { TabBar } from './ui/chrome';
import { ConfirmSheet } from './ui/ConfirmSheet';
import { DeleteSheet, DetailSheet } from './ui/DetailSheet';
import { LibraryPage } from './ui/LibraryPage';
import { ManualSheet } from './ui/ManualSheet';
import { PhotoSheet } from './ui/PhotoSheet';
import { SettingsPage } from './ui/SettingsPage';

function tabFromHash(): TabId {
  const h = location.hash.replace(/^#\/?/, '');
  if (h === 'wishlist' || h === 'add' || h === 'settings' || h === 'collection') return h;
  return 'collection';
}

function emptyCandidate(artist = '', title = ''): DraftCandidate {
  return { rgid: null, artist, title, year: null, label: '', sim: null, score: null };
}

function draftFromResult(result: IdentifyResult, file: File, photoUrl: string): Draft {
  const candidates: DraftCandidate[] = result.ranked.slice(0, 3).map((r) => ({
    rgid: r.rgid,
    artist: r.artist,
    title: r.title,
    year: null,
    label: '',
    sim: r.sim,
    score: r.score,
  }));
  if (!candidates.length) candidates.push(emptyCandidate());
  const top = candidates[0];
  return {
    photoBlob: file,
    photoUrl,
    usePhoto: false,
    list: 'collection',
    selected: 0,
    candidates,
    confident: result.confident,
    fast: result.fast,
    clip: result.clip,
    status: top.artist ? `Found: ${top.artist} - ${top.title}` : '',
  };
}

export function App() {
  const [prefs, setPrefs] = useState(loadPrefs);
  const [tab, setTab] = useState<TabId>(tabFromHash);
  const [records, setRecords] = useState<SleeveRecord[]>([]);
  const [query, setQuery] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [researching, setResearching] = useState(false);
  const [toast, setToast] = useState('');
  const [photo, setPhoto] = useState<{ file: File; preview: string; step: string; progress: number | null; error: string | null } | null>(null);
  const job = useRef(0);

  useEffect(() => {
    applyTheme(prefs.theme);
  }, [prefs.theme]);

  useEffect(() => {
    const pull = () => {
      void listRecords().then(setRecords);
    };
    pull();
    return subscribe(pull);
  }, []);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  function go(next: TabId) {
    setTab(next);
    const hash = `#/${next}`;
    if (location.hash !== hash) history.replaceState(null, '', hash);
  }

  function updatePrefs(partial: Partial<typeof prefs>) {
    setPrefs((prev) => {
      const next = { ...prev, ...partial };
      savePrefs(next);
      return next;
    });
  }

  const shelf: Shelf = tab === 'wishlist' ? 'wishlist' : 'collection';
  const visible = useMemo(() => {
    const mine = records.filter((r) => r.list === shelf);
    return sortRecords(filterRecords(mine, query), prefs.sort);
  }, [records, shelf, query, prefs.sort]);

  async function runPhoto(file: File, preview: string) {
    const id = ++job.current;
    setPhoto({ file, preview, step: 'Finding the cover', progress: null, error: null });
    setDraft(null);
    try {
      const result = await identify(file, (s) => {
        if (job.current !== id) return;
        setPhoto((p) => (p ? { ...p, step: s.step, progress: s.progress } : p));
      });
      if (job.current !== id) return;
      setPhoto(null);
      setDraft(draftFromResult(result, file, preview));
    } catch (err) {
      if (job.current !== id) return;
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setPhoto((p) => (p ? { ...p, error: err instanceof Error ? err.message : String(err), progress: null } : p));
    }
  }

  function startPhoto(file: File) {
    const preview = URL.createObjectURL(file);
    void runPhoto(file, preview);
  }

  function closePhoto() {
    job.current++;
    cancelIdentify();
    if (photo) URL.revokeObjectURL(photo.preview);
    setPhoto(null);
  }

  async function saveDraft() {
    if (!draft) return;
    const chosen = draft.candidates[draft.selected] || draft.candidates[0];
    const artist = (chosen?.artist || '').trim();
    const title = (chosen?.title || '').trim();
    if (!artist || !title) return;
    let cover: Blob | null = null;
    let coverKind: SleeveRecord['coverKind'] = 'none';
    if (draft.usePhoto && draft.photoBlob) {
      cover = draft.photoBlob;
      coverKind = 'photo';
    } else if (chosen?.rgid) {
      cover = await fetchCover(chosen.rgid);
      if (cover) coverKind = 'caa';
      else if (draft.photoBlob) {
        cover = draft.photoBlob;
        coverKind = 'photo';
      }
    } else if (draft.photoBlob) {
      cover = draft.photoBlob;
      coverKind = 'photo';
    }
    const id = newId();
    const now = Date.now();
    const record: SleeveRecord = {
      id,
      list: draft.list,
      artist,
      title,
      year: chosen?.year ?? null,
      label: chosen?.label || '',
      format: 'LP',
      notes: '',
      rgid: chosen?.rgid ?? null,
      cover,
      coverKind,
      addedAt: now,
      updatedAt: now,
    };
    await putRecord(record);
    const rgid = chosen?.rgid ?? null;
    void (async () => {
      const official = rgid ? await fetchCover(rgid) : null;
      const blob = official || cover;
      if (blob) await rememberCover(rgid || id, rgid, artist, title, blob);
    })();
    if (draft.photoUrl) URL.revokeObjectURL(draft.photoUrl);
    setDraft(null);
    go(record.list === 'wishlist' ? 'wishlist' : 'collection');
    setToast(record.list === 'wishlist' ? 'Saved to Wishlist' : 'Saved to Collection');
  }

  async function research(artist: string, album: string) {
    if (!draft) return;
    setResearching(true);
    try {
      const found = await searchByName(artist, album);
      const candidates = found.length ? found.slice(0, 3) : [emptyCandidate(artist, album)];
      setDraft({ ...draft, candidates, selected: 0, confident: false });
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setResearching(false);
    }
  }

  const detail = records.find((r) => r.id === detailId) || null;
  const doomed = records.find((r) => r.id === deleteId) || null;

  return (
    <div className="app">
      {tab === 'collection' || tab === 'wishlist' ? (
        <LibraryPage
          title={tab === 'wishlist' ? 'Wishlist' : 'Collection'}
          shelf={shelf}
          records={visible}
          query={query}
          onQuery={setQuery}
          sort={prefs.sort}
          onSort={(sort) => updatePrefs({ sort })}
          view={prefs.view}
          onView={(view) => updatePrefs({ view })}
          onOpen={setDetailId}
          onMove={(id) => {
            const rec = records.find((r) => r.id === id);
            if (!rec) return;
            void putRecord({ ...rec, list: rec.list === 'collection' ? 'wishlist' : 'collection', updatedAt: Date.now() });
          }}
          onDelete={setDeleteId}
          onAddPhoto={() => go('add')}
          onSearch={() => {
            go('add');
            setManual(true);
          }}
        />
      ) : null}
      {tab === 'add' && <AddPage onFile={startPhoto} onManual={() => setManual(true)} />}
      {tab === 'settings' && <SettingsPage theme={prefs.theme} onTheme={(theme) => updatePrefs({ theme })} />}
      <TabBar tab={tab} onChange={go} />

      {photo && (
        <PhotoSheet
          preview={photo.preview}
          step={photo.step}
          progress={photo.progress}
          error={photo.error}
          onClose={closePhoto}
          onRetry={() => void runPhoto(photo.file, photo.preview)}
          onType={() => {
            const file = photo.file;
            const preview = photo.preview;
            setPhoto(null);
            setDraft({
              photoBlob: file,
              photoUrl: preview,
              usePhoto: true,
              list: 'collection',
              selected: 0,
              candidates: [emptyCandidate()],
              confident: false,
              fast: false,
              clip: false,
              status: '',
            });
          }}
        />
      )}
      {manual && (
        <ManualSheet
          onClose={() => setManual(false)}
          onPick={(candidates, artist, album) => {
            setManual(false);
            setDraft({
              photoBlob: null,
              photoUrl: null,
              usePhoto: false,
              list: tab === 'wishlist' ? 'wishlist' : 'collection',
              selected: 0,
              candidates: candidates.length ? candidates : [emptyCandidate(artist, album)],
              confident: candidates.length === 1,
              fast: false,
              clip: true,
              status: '',
            });
          }}
        />
      )}
      {draft && (
        <ConfirmSheet
          draft={draft}
          onChange={(recipe) => setDraft((d) => (d ? recipe(d) : d))}
          onClose={() => {
            if (draft.photoUrl) URL.revokeObjectURL(draft.photoUrl);
            setDraft(null);
          }}
          onSave={() => void saveDraft()}
          onResearch={(artist, album) => void research(artist, album)}
          busy={researching}
        />
      )}
      {detail && (
        <DetailSheet
          record={detail}
          onClose={() => setDetailId(null)}
          onSave={(next) => void putRecord(next)}
          onMove={() => void putRecord({ ...detail, list: detail.list === 'collection' ? 'wishlist' : 'collection', updatedAt: Date.now() })}
          onDelete={() => setDeleteId(detail.id)}
        />
      )}
      {doomed && (
        <DeleteSheet
          title={`${doomed.artist} — ${doomed.title}`}
          onClose={() => setDeleteId(null)}
          onConfirm={() => {
            void deleteRecord(doomed.id);
            setDeleteId(null);
            if (detailId === doomed.id) setDetailId(null);
          }}
        />
      )}
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

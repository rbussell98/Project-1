import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { BackupFile, SleeveRecord } from './types';

interface CacheRow {
  key: string;
  body: string;
  at: number;
}
interface ArtRow {
  key: string;
  blob: Blob | null;
  missing?: boolean;
  at: number;
}
export interface EmbRow {
  key: string;
  rgid: string | null;
  artist: string;
  title: string;
  vec: ArrayBufferLike;
}

interface SleeveDB extends DBSchema {
  records: {
    key: string;
    value: SleeveRecord;
    indexes: { 'by-list': string; 'by-added': number };
  };
  cache: { key: string; value: CacheRow };
  art: { key: string; value: ArtRow };
  embeddings: { key: string; value: EmbRow };
}

const listeners = new Set<() => void>();

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn();
}

let dbPromise: Promise<IDBPDatabase<SleeveDB>> | null = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<SleeveDB>('sleeve', 1, {
      upgrade(db) {
        const rec = db.createObjectStore('records', { keyPath: 'id' });
        rec.createIndex('by-list', 'list');
        rec.createIndex('by-added', 'addedAt');
        db.createObjectStore('cache', { keyPath: 'key' });
        db.createObjectStore('art', { keyPath: 'key' });
        db.createObjectStore('embeddings', { keyPath: 'key' });
      },
    });
  }
  return dbPromise;
}

export async function listRecords(): Promise<SleeveRecord[]> {
  const rows = await (await getDb()).getAll('records');
  rows.sort((a, b) => b.addedAt - a.addedAt);
  return rows;
}

export async function getRecord(id: string): Promise<SleeveRecord | undefined> {
  return (await getDb()).get('records', id);
}

export async function putRecord(record: SleeveRecord): Promise<void> {
  await (await getDb()).put('records', record);
  emit();
}

export async function deleteRecord(id: string): Promise<void> {
  const db = await getDb();
  const existing = await db.get('records', id);
  await db.delete('records', id);
  if (existing) {
    const key = existing.rgid || existing.id;
    const others = await db.getAll('records');
    const stillUsed = others.some((r) => (r.rgid || r.id) === key);
    if (!stillUsed) await db.delete('embeddings', key);
  }
  emit();
}

export function newId(): string {
  return crypto.randomUUID();
}

export async function cacheGet(key: string): Promise<string | undefined> {
  const row = await (await getDb()).get('cache', key);
  return row?.body;
}

export async function cacheSet(key: string, body: string): Promise<void> {
  await (await getDb()).put('cache', { key, body, at: Date.now() });
}

/** undefined = not cached, null = cached miss */
export async function artGet(key: string): Promise<Blob | null | undefined> {
  const row = await (await getDb()).get('art', key);
  if (!row) return undefined;
  if (row.missing || !row.blob) return null;
  return row.blob;
}

export async function artSet(key: string, blob: Blob | null): Promise<void> {
  await (await getDb()).put('art', { key, blob, missing: blob == null, at: Date.now() });
}

export async function allEmbeddings(): Promise<EmbRow[]> {
  return (await getDb()).getAll('embeddings');
}

export async function putEmbedding(row: EmbRow): Promise<void> {
  await (await getDb()).put('embeddings', row);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return blob.arrayBuffer().then((ab) => {
    const bytes = new Uint8Array(ab);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return `data:${blob.type || 'image/jpeg'};base64,${btoa(binary)}`;
  });
}

export function dataUrlToBlob(url: string): Blob {
  const comma = url.indexOf(',');
  const head = url.slice(0, comma);
  const b64 = url.slice(comma + 1);
  const mime = /data:(.*?);/.exec(head)?.[1] || 'application/octet-stream';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export async function exportBackup(): Promise<BackupFile> {
  const records = await listRecords();
  const out = [];
  for (const r of records) {
    const { cover, ...rest } = r;
    out.push({ ...rest, cover: cover ? await blobToDataUrl(cover) : null });
  }
  return { sleeve: 1, exportedAt: new Date().toISOString(), records: out };
}

export async function importBackup(data: BackupFile): Promise<number> {
  if (!data || data.sleeve !== 1 || !Array.isArray(data.records)) {
    throw new Error('This file is not a Sleeve backup.');
  }
  const db = await getDb();
  const tx = db.transaction('records', 'readwrite');
  let n = 0;
  for (const raw of data.records) {
    if (!raw || typeof raw.artist !== 'string' || typeof raw.title !== 'string') continue;
    const cover = raw.cover ? dataUrlToBlob(raw.cover) : null;
    const record: SleeveRecord = {
      id: typeof raw.id === 'string' && raw.id ? raw.id : newId(),
      list: raw.list === 'wishlist' ? 'wishlist' : 'collection',
      artist: raw.artist,
      title: raw.title,
      year: typeof raw.year === 'number' ? raw.year : null,
      label: raw.label || '',
      format: raw.format || 'LP',
      notes: raw.notes || '',
      rgid: raw.rgid || null,
      cover,
      coverKind: raw.coverKind || (cover ? 'photo' : 'none'),
      addedAt: typeof raw.addedAt === 'number' ? raw.addedAt : Date.now(),
      updatedAt: Date.now(),
    };
    await tx.store.put(record);
    n++;
  }
  await tx.done;
  emit();
  return n;
}

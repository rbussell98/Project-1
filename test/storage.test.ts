import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import { deleteRecord, exportBackup, getRecord, importBackup, listRecords, newId, putRecord } from '../src/db';
import { filterRecords, sortRecords } from '../src/query';
import type { SleeveRecord } from '../src/types';

function record(partial: Partial<SleeveRecord> & Pick<SleeveRecord, 'artist' | 'title'>): SleeveRecord {
  const now = partial.addedAt ?? Date.now();
  return {
    id: partial.id || newId(),
    list: partial.list || 'collection',
    artist: partial.artist,
    title: partial.title,
    year: partial.year ?? null,
    label: partial.label || '',
    format: partial.format || 'LP',
    notes: partial.notes || '',
    rgid: partial.rgid ?? null,
    cover: partial.cover ?? null,
    coverKind: partial.coverKind || (partial.cover ? 'photo' : 'none'),
    addedAt: now,
    updatedAt: partial.updatedAt ?? now,
  };
}

beforeEach(async () => {
  const rows = await listRecords();
  for (const row of rows) await deleteRecord(row.id);
});

test('saves, moves, and deletes a record on the device', async () => {
  const row = record({ artist: 'Jack Johnson', title: 'Meet the Moonlight', year: 2022, label: 'Brushfire' });
  await putRecord(row);
  expect((await listRecords()).map((r) => r.title)).toEqual(['Meet the Moonlight']);
  await putRecord({ ...row, list: 'wishlist', updatedAt: Date.now() });
  expect((await getRecord(row.id))?.list).toBe('wishlist');
  await deleteRecord(row.id);
  expect(await listRecords()).toEqual([]);
});

test('backup round-trips covers and shelves', async () => {
  const cover = new Blob([Uint8Array.from([1, 2, 3, 4])], { type: 'image/jpeg' });
  await putRecord(record({ artist: 'Miles Davis', title: 'Kind of Blue', year: 1959, label: 'Columbia', cover, coverKind: 'caa', list: 'collection' }));
  await putRecord(record({ artist: 'Beach House', title: 'Depression Cherry', list: 'wishlist', addedAt: 20 }));
  const backup = await exportBackup();
  expect(backup.sleeve).toBe(1);
  expect(backup.records).toHaveLength(2);
  expect(backup.records.find((r) => r.title === 'Kind of Blue')?.cover?.startsWith('data:image/jpeg;base64,')).toBe(true);
  for (const row of await listRecords()) await deleteRecord(row.id);
  const n = await importBackup(backup);
  expect(n).toBe(2);
  const restored = await listRecords();
  const blue = restored.find((r) => r.title === 'Kind of Blue');
  expect(blue?.artist).toBe('Miles Davis');
  expect(blue?.year).toBe(1959);
  expect(blue?.label).toBe('Columbia');
  expect(blue?.list).toBe('collection');
  expect(blue?.cover).toBeInstanceOf(Blob);
  expect(new Uint8Array(await blue!.cover!.arrayBuffer())).toEqual(Uint8Array.from([1, 2, 3, 4]));
  expect(restored.find((r) => r.title === 'Depression Cherry')?.list).toBe('wishlist');
});

test('search and sort cover artist, title, label, and year', () => {
  const rows = [
    record({ artist: 'Miles Davis', title: 'Kind of Blue', year: 1959, label: 'Columbia', addedAt: 1 }),
    record({ artist: 'Jack Johnson', title: 'Meet the Moonlight', year: 2022, label: 'Brushfire', addedAt: 3 }),
    record({ artist: 'Norah Jones', title: 'Come Away With Me', year: 2002, label: 'Blue Note', addedAt: 2 }),
  ];
  expect(filterRecords(rows, 'brush').map((r) => r.title)).toEqual(['Meet the Moonlight']);
  expect(filterRecords(rows, '1959').map((r) => r.artist)).toEqual(['Miles Davis']);
  expect(filterRecords(rows, 'blue').map((r) => r.title).sort()).toEqual(['Come Away With Me', 'Kind of Blue']);
  expect(sortRecords(rows, 'artist').map((r) => r.artist)).toEqual(['Jack Johnson', 'Miles Davis', 'Norah Jones']);
  expect(sortRecords(rows, 'year').map((r) => r.year)).toEqual([2022, 2002, 1959]);
  expect(sortRecords(rows, 'added')[0].title).toBe('Meet the Moonlight');
});

test('rejects a file that is not a Sleeve backup', async () => {
  await expect(importBackup({ sleeve: 2 } as never)).rejects.toThrow(/not a Sleeve backup/);
});

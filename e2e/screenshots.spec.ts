import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const shots = path.resolve('shots');
fs.mkdirSync(shots, { recursive: true });

function dataUrl(file: string) {
  const buf = fs.readFileSync(file);
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

async function recordCount(page: import('@playwright/test').Page) {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const req = indexedDB.open('sleeve');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('records')) {
            resolve(0);
            return;
          }
          const tx = db.transaction('records').objectStore('records').count();
          tx.onerror = () => reject(tx.error);
          tx.onsuccess = () => resolve(tx.result);
        };
      }),
  );
}

test('iPhone screens of the shelf', async ({ page }) => {
  page.on('pageerror', (err) => console.log('PAGEERROR', err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('CONSOLE', msg.text());
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Collection' })).toBeVisible();
  await expect(page.getByTestId('empty-collection')).toContainText('The room is quiet.');
  await page.screenshot({ path: path.join(shots, '01-empty-collection.png') });

  const backup = {
    sleeve: 1,
    exportedAt: '2026-11-12T00:00:00.000Z',
    records: [
      {
        id: 'rec-blue',
        list: 'collection',
        artist: 'Miles Davis',
        title: 'Kind of Blue',
        year: 1959,
        label: 'Columbia',
        format: 'LP',
        notes: 'The one that stays on the platter.',
        rgid: '8e8a594f-2175-38c7-a871-abb68ec363e7',
        coverKind: 'caa',
        cover: dataUrl('e2e/fixtures/kind-of-blue.jpg'),
        addedAt: 1,
        updatedAt: 1,
      },
      {
        id: 'rec-norah',
        list: 'collection',
        artist: 'Norah Jones',
        title: 'Come Away With Me',
        year: 2002,
        label: 'Blue Note',
        format: 'LP',
        notes: '',
        rgid: '6ccac9d2-22ed-33de-bd5d-f2aadcacf7f8',
        coverKind: 'caa',
        cover: dataUrl('e2e/fixtures/come-away.jpg'),
        addedAt: 2,
        updatedAt: 2,
      },
      {
        id: 'rec-jack',
        list: 'collection',
        artist: 'Jack Johnson',
        title: 'Meet the Moonlight',
        year: 2022,
        label: 'Brushfire',
        format: 'LP',
        notes: '',
        rgid: '3d88aa7d-fb1c-433f-9df6-e3d294671304',
        coverKind: 'photo',
        cover: dataUrl('eval/real/jj_moonlight_screenshot.jpg'),
        addedAt: 3,
        updatedAt: 3,
      },
      {
        id: 'rec-beach',
        list: 'wishlist',
        artist: 'Beach House',
        title: 'Depression Cherry',
        year: 2015,
        label: 'Sub Pop',
        format: 'LP',
        notes: '',
        rgid: 'da216e7b-9ce3-4347-8f59-bc758dca2da1',
        coverKind: 'caa',
        cover: dataUrl('e2e/fixtures/depression-cherry.jpg'),
        addedAt: 4,
        updatedAt: 4,
      },
    ],
  };
  const backupPath = path.join(shots, 'backup.json');
  fs.writeFileSync(backupPath, JSON.stringify(backup));

  await page.getByTestId('tab-settings').click();
  await page.getByTestId('import').setInputFiles(backupPath);
  await expect(page.getByText('Imported 4 records.')).toBeVisible();

  await page.getByTestId('tab-collection').click();
  await expect(page.getByTestId('record-card')).toHaveCount(3);
  await page.screenshot({ path: path.join(shots, '02-collection.png') });

  await page.getByRole('button', { name: /Kind of Blue/ }).click();
  await expect(page.getByTestId('detail-sheet')).toBeVisible();
  await expect(page.getByText('Columbia')).toBeVisible();
  await expect(page.getByRole('link', { name: 'MusicBrainz' })).toBeVisible();
  await page.screenshot({ path: path.join(shots, '06-detail.png') });
  await page.getByTestId('sheet-close').click();

  await page.getByTestId('tab-wishlist').click();
  await expect(page.getByText('Depression Cherry')).toBeVisible();
  await page.screenshot({ path: path.join(shots, '03-wishlist.png') });

  await page.getByTestId('tab-add').click();
  const before = await recordCount(page);
  expect(before).toBe(4);
  await page.getByTestId('library-input').setInputFiles(path.resolve('eval/real/jj_moonlight_screenshot.jpg'));
  await expect(page.getByTestId('photo-status')).toBeVisible();
  await page.screenshot({ path: path.join(shots, '04-add-progress.png') });

  await expect(page.getByTestId('confirm-sheet')).toBeVisible({ timeout: 180_000 });
  await expect(page.getByTestId('confirm-title')).toContainText(/Moonlight/i);
  await expect(page.getByTestId('confirm-sheet')).toContainText('Jack Johnson');
  expect(await recordCount(page)).toBe(4);
  await page.screenshot({ path: path.join(shots, '05-confirm.png') });

  await page.getByTestId('save-record').click();
  await expect(page.getByText('Saved to Collection')).toBeVisible();
  expect(await recordCount(page)).toBe(5);
  await expect(page.getByTestId('record-card')).toHaveCount(4);
});

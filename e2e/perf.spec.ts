import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

// iPhone-ish: 393x852 from the Playwright config, plus a 4x CPU slowdown.
test('shell is interactive before the image model, then a photo matches', async ({ page }) => {
  test.setTimeout(420_000);
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  let modelBytes = 0;
  page.on('response', (res) => {
    const url = res.url();
    if (!/huggingface\.co|\.hf\.co|onnx/i.test(url)) return;
    const len = Number(res.headers()['content-length'] || 0);
    if (len) modelBytes += len;
  });

  const t0 = Date.now();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Collection' })).toBeVisible();
  await page.getByTestId('tab-settings').click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByTestId('tab-collection').click();
  await expect(page.getByRole('heading', { name: 'Collection' })).toBeVisible();
  const ttiMs = Date.now() - t0;

  const phaseAtInteractive = await page.locator('.app').getAttribute('data-model');
  expect(phaseAtInteractive === 'idle' || phaseAtInteractive === 'loading').toBeTruthy();

  await expect(page.locator('.app')).toHaveAttribute('data-model', 'ready', { timeout: 300_000 });
  const modelReadyMs = Date.now() - t0;
  const reported = Number((await page.locator('.app').getAttribute('data-model-bytes')) || 0);

  await page.getByTestId('tab-add').click();
  const cold0 = Date.now();
  await page.getByTestId('library-input').setInputFiles(path.resolve('eval/real/jj_moonlight_screenshot.jpg'));
  await expect(page.getByTestId('confirm-sheet')).toBeVisible({ timeout: 180_000 });
  const coldMatchMs = Date.now() - cold0;
  await page.getByTestId('sheet-close').click();

  const warm0 = Date.now();
  await page.getByTestId('library-input').setInputFiles(path.resolve('eval/real/jj_moonlight_screenshot.jpg'));
  await expect(page.getByTestId('confirm-sheet')).toBeVisible({ timeout: 120_000 });
  const warmMatchMs = Date.now() - warm0;

  const report = {
    viewport: '393x852',
    cpuThrottle: 4,
    ttiMs,
    modelReadyMs,
    modelBytes: Math.max(modelBytes, reported),
    coldMatchMs,
    warmMatchMs,
    phaseAtInteractive,
  };
  fs.mkdirSync('eval', { recursive: true });
  fs.writeFileSync('eval/phone-perf.json', JSON.stringify(report, null, 2));
  console.log('PHONE_PERF', JSON.stringify(report));
  expect(ttiMs).toBeLessThan(8_000);
});

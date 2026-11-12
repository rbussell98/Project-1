import { chromium } from '@playwright/test';

const browser = await chromium.launch({
  headless: false,
  slowMo: 280,
  args: ['--window-position=720,20', '--window-size=460,980'],
});
const page = await browser.newPage({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  colorScheme: 'dark',
});
await page.goto('http://127.0.0.1:5173/#/add');
await page.getByTestId('library-input').setInputFiles('eval/real/jj_moonlight_screenshot.jpg');
await page.getByTestId('confirm-sheet').waitFor({ timeout: 120000 });
await page.getByText('2022').waitFor({ timeout: 20000 });
await page.locator('.pick img').nth(2).waitFor({ timeout: 20000 });
await page.waitForTimeout(2200);
await page.getByTestId('save-record').click();
await page.getByText('Saved to Collection').waitFor();
await page.waitForTimeout(2500);
await browser.close();

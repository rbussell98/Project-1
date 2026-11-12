import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { createMatcher } from '../matcher/src/pipeline.mjs';

const PHOTO = path.resolve('eval/real/jj_moonlight_screenshot.jpg');
const TRUTH = '3d88aa7d-fb1c-433f-9df6-e3d294671304';

describe('Jack Johnson Meet the Moonlight', () => {
  test('fast path ranks the real photo top-1', async () => {
    expect(fs.existsSync(PHOTO)).toBe(true);
    const matcher = await createMatcher({ ocrWorkers: 1 });
    const wall0 = Date.now();
    let result: Awaited<ReturnType<typeof matcher.identify>>;
    try {
      result = await matcher.identify(PHOTO, { log: () => {} });
    } finally {
      await matcher.close();
    }
    const wallMs = Date.now() - wall0;
    const top = result.ranked[0];
    const second = result.ranked[1]?.sim ?? 0;
    const report = {
      wallMs,
      timing: result.timing,
      fast: result.fast,
      confident: result.confident,
      cropFound: result.cropFound,
      barcode: result.barcode,
      sim: top?.sim ?? null,
      second,
      margin: top ? top.sim - second : null,
      artist: top?.artist ?? null,
      title: top?.title ?? null,
      rgid: top?.rgid ?? null,
    };
    fs.mkdirSync('eval', { recursive: true });
    fs.writeFileSync('eval/jj-fastpath-result.json', JSON.stringify(report, null, 2));
    console.log('JJ_FASTPATH', JSON.stringify(report));
    expect(result.fast).toBe(true);
    expect(top?.rgid).toBe(TRUTH);
    expect(top?.artist).toBe('Jack Johnson');
    expect(top?.title).toBe('Meet the Moonlight');
    expect(top?.sim).toBeGreaterThanOrEqual(0.9);
    expect((top?.sim ?? 0) - second).toBeGreaterThanOrEqual(0.06);
  });
});

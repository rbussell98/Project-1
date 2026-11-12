import { expect, test } from 'vitest';
import { CONF_MARGIN, CONF_SIM, FAST_MARGIN, FAST_SIM, TEXT_WEIGHT, blend, fastAccept, isConfident } from '../src/matcher/rank';
import { CONF_MARGIN as M_CONF_MARGIN, CONF_SIM as M_CONF_SIM, FAST_MARGIN as M_FAST_MARGIN, FAST_SIM as M_FAST_SIM, TEXT_WEIGHT as M_TEXT_WEIGHT, blend as blendMjs, fastAccept as fastAcceptMjs, isConfident as isConfidentMjs } from '../matcher/src/rank.mjs';

test('thresholds stay locked to the measured pipeline', () => {
  expect(FAST_SIM).toBe(0.9);
  expect(FAST_MARGIN).toBe(0.06);
  expect(TEXT_WEIGHT).toBe(0.15);
  expect(CONF_SIM).toBe(0.8);
  expect(CONF_MARGIN).toBe(0.04);
  expect(FAST_SIM).toBe(M_FAST_SIM);
  expect(FAST_MARGIN).toBe(M_FAST_MARGIN);
  expect(TEXT_WEIGHT).toBe(M_TEXT_WEIGHT);
  expect(CONF_SIM).toBe(M_CONF_SIM);
  expect(CONF_MARGIN).toBe(M_CONF_MARGIN);
});

test('fast path accepts the Jack Johnson margin and rejects a near neighbour', () => {
  const top = { sim: 0.9567 };
  const second = { sim: 0.8259 };
  expect(fastAccept(top, second)).toBe(true);
  expect(fastAccept(top, second)).toBe(fastAcceptMjs(top, second, {}));
  expect(fastAccept({ sim: 0.91 }, { sim: 0.88 })).toBe(false);
  expect(fastAccept({ sim: 0.89 }, { sim: 0.5 })).toBe(false);
  expect(fastAccept(undefined, undefined)).toBe(false);
  expect(fastAccept(top, second, false)).toBe(false);
});

test('final score is cosine plus a small text bonus', () => {
  expect(blend(0.8, 1)).toBeCloseTo(0.95);
  expect(blend(0.8, 0)).toBe(0.8);
  expect(blend(0.8, 1)).toBe(blendMjs(0.8, 1));
});

test('confidence needs both cosine and a score margin', () => {
  const ok = [
    { sim: 0.86, score: 0.9 },
    { sim: 0.8, score: 0.84 },
  ];
  expect(isConfident(ok)).toBe(true);
  expect(isConfident(ok)).toBe(isConfidentMjs(ok, {}));
  expect(isConfident([{ sim: 0.9, score: 0.9 }, { sim: 0.8, score: 0.88 }])).toBe(false);
  expect(isConfident([{ sim: 0.79, score: 0.9 }])).toBe(false);
  expect(isConfident([])).toBe(false);
});

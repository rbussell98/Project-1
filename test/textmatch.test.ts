import { expect, test } from 'vitest';
import { goodLines } from '../src/matcher/ocrtext';
import { ocrWordSet, textScore, tokenMatch, words } from '../src/matcher/textmatch';
import { goodLines as goodLinesMjs } from '../matcher/src/ocrtext.mjs';
import { textScore as textScoreMjs, tokenMatch as tokenMatchMjs } from '../matcher/src/textmatch.mjs';

test('token match: exact, one edit, and a long suffix', () => {
  expect(tokenMatch('voyage', ['voyage'])).toBe(1);
  expect(tokenMatch('voyage', ['voyege'])).toBe(0.85);
  // one missing letter is an edit; a longer clipped suffix is the 0.6 partial
  expect(tokenMatch('voyage', ['oyage'])).toBe(0.85);
  expect(tokenMatch('between', ['tween'])).toBe(0.6);
  expect(tokenMatch('cat', ['cot'])).toBe(0);
  expect(tokenMatch('blue', ['glue'])).toBe(0.85);
});

test('text score averages artist and title and drops stop words', () => {
  const phrases = [{ text: 'Jack Johnson' }, { text: 'Meet the Moonlight' }];
  const ocr = ocrWordSet(phrases);
  const score = textScore({ artist: 'Jack Johnson', title: 'Meet the Moonlight' }, ocr);
  expect(score.artist).toBe(1);
  expect(score.title).toBe(1);
  expect(score.total).toBe(1);
  expect(score.both).toBe(1);
  const partial = textScore({ artist: 'Jack Johnson', title: 'In Between Dreams' }, ocr);
  expect(partial.artist).toBe(1);
  expect(partial.title).toBe(0);
  expect(partial.total).toBe(0.5);
});

test('words fold accents and expand ampersands', () => {
  expect(words('Café & Tea')).toEqual(['cafe', 'and', 'tea']);
});

test('the browser port matches the node matcher on the same phrases', () => {
  const ocr = ['jack', 'johnson', 'moonlight', 'oyage'];
  const cand = { artist: 'Jack Johnson', title: 'Meet the Moonlight' };
  expect(tokenMatch('voyage', ocr)).toBe(tokenMatchMjs('voyage', ocr));
  expect(textScore(cand, ocr)).toEqual(textScoreMjs(cand, ocr));
});

test('good lines keep real words and drop junk', () => {
  const lines = [
    { text: 'JACK JOHNSON', conf: 90, tag: 'whole/dark' },
    { text: 'JACK JOHNSON', conf: 80, tag: 'top/dark' },
    { text: 'xqz', conf: 99, tag: 'whole/dark' },
    { text: '1234', conf: 90, tag: 'whole/dark' },
    { text: 'ab', conf: 90, tag: 'whole/dark' },
  ];
  const kept = goodLines(lines);
  expect(kept.map((l) => l.text)).toEqual(['JACK JOHNSON']);
  expect(kept[0].count).toBe(2);
  expect(goodLinesMjs(lines).map((l: { text: string }) => l.text)).toEqual(['JACK JOHNSON']);
});

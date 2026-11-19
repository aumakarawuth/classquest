import { summarize, toCsv, type PrePostRow } from './prepost';

const rows: PrePostRow[] = [
  { student: 'S01', pre_percent: 40, post_percent: 80, gain: 40, normalized_gain: 0.667 },
  { student: 'S02', pre_percent: 60, post_percent: 70, gain: 10, normalized_gain: 0.25 },
  { student: 'S03', pre_percent: 50, post_percent: null, gain: null, normalized_gain: null },
];

it('summarizes only paired students', () => {
  const s = summarize(rows);
  expect(s.enrolled).toBe(3);
  expect(s.paired).toBe(2);
  expect(s.meanPre).toBe(50);
  expect(s.meanPost).toBe(75);
  expect(s.meanGain).toBe(25);
  expect(s.sdGain).toBe(21.21);
  expect(s.t).toBe(1.667);
  expect(s.df).toBe(1);
  expect(s.improved).toBe(2);
});

it('returns nulls instead of numbers when there is no data', () => {
  const s = summarize([]);
  expect(s.meanGain).toBeNull();
  expect(s.t).toBeNull();
});

it('builds Excel-friendly CSV and neutralises formulas', () => {
  const csv = toCsv([
    {
      student: '=HYPERLINK("x")',
      pre_percent: 10,
      post_percent: null,
      gain: null,
      normalized_gain: null,
    },
  ]);
  expect(csv.startsWith('﻿')).toBe(true);
  expect(csv).toContain(`"'=HYPERLINK(""x"")",10,,,`);
});

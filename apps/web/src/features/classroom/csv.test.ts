import { parseCsv, rosterFromCsv, toCsv } from './csv';

it('parses quoted CSV with BOM and CRLF', () => {
  expect(parseCsv('﻿a,"b,c","d ""e"""\r\n1,2,3\n')).toEqual([
    ['a', 'b,c', 'd "e"'],
    ['1', '2', '3'],
  ]);
});

it('maps Thai/English headers, normalises and de-duplicates emails', () => {
  const rows = parseCsv(
    'ชื่อ-สกุล,รหัสนักเรียน,อีเมล\nสมชาย ใจดี,66001,Somchai@School.ac.th\nซ้ำ,66001,somchai@school.ac.th\nผิด,66003,not-email',
  );
  const r = rosterFromCsv(rows);
  expect(r.valid).toEqual([
    { email: 'somchai@school.ac.th', student_code: '66001', display_name: 'สมชาย ใจดี' },
  ]);
  expect(r.invalid).toEqual([{ line: 4, value: 'ผิด, 66003, not-email' }]);
});

it('finds the email column without a known header', () => {
  const r = rosterFromCsv(parseCsv('A,B\nx,a@b.co'));
  expect(r.valid[0]?.email).toBe('a@b.co');
});

it('writes CSV with BOM and neutralised formulas', () => {
  expect(toCsv([['=1+1', 'a,b', 5]])).toBe('﻿\'=1+1,"a,b",5');
});

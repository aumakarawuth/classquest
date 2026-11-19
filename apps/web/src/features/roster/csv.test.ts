import { toCsv } from './csv';

it('quotes, adds BOM and neutralises formulas', () => {
  expect(
    toCsv([
      ['ชื่อ', 'a,b'],
      ['=SUM(A1)', null],
      ['-5', 3],
    ]),
  ).toBe('﻿ชื่อ,"a,b"\r\n\'=SUM(A1),\r\n\'-5,3');
});

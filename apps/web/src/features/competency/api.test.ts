import { cellStatus } from './api';

it('maps matrix cells to Thai-ready statuses', () => {
  expect(cellStatus(undefined)).toBe('not_assessed');
  expect(cellStatus({ passed: null })).toBe('not_assessed');
  expect(cellStatus({ passed: true })).toBe('passed');
  expect(cellStatus({ passed: false })).toBe('developing');
});

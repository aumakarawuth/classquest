import { sanitizeSearch } from './api';

it('strips PostgREST filter syntax from search input', () => {
  expect(sanitizeSearch('  สมชาย,status.eq.active) ')).toBe('สมชาย status.eq.active');
  expect(sanitizeSearch('100%_*')).toBe('100');
});

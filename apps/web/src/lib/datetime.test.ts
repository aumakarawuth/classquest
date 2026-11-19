import { formatThaiDateTime } from './datetime';

describe('formatThaiDateTime', () => {
  it('converts UTC to Asia/Bangkok (UTC+7)', () => {
    // 17:30 UTC = 00:30 next day in Bangkok
    expect(formatThaiDateTime('2026-01-01T17:30:00Z')).toContain('00:30');
  });
});

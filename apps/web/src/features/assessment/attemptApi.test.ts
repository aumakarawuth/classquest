import { formatClock, secondsLeft } from './attemptApi';

it('computes remaining time', () => {
  const now = Date.parse('2026-11-19T10:00:00Z');
  expect(secondsLeft(null, now)).toBeNull();
  expect(secondsLeft('2026-11-19T10:01:30Z', now)).toBe(90);
  expect(secondsLeft('2026-11-19T09:59:00Z', now)).toBe(0);
  expect(formatClock(90)).toBe('1:30');
  expect(formatClock(5)).toBe('0:05');
});

import { readStoredTheme, resolveTheme, storeTheme } from './theme';

describe('theme', () => {
  it('resolves system preference', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('persists and reads preference, ignoring invalid values', () => {
    storeTheme('dark');
    expect(readStoredTheme()).toBe('dark');
    localStorage.setItem('classquest.theme', 'neon');
    expect(readStoredTheme()).toBe('system');
  });
});

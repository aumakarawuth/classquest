import { navAreas } from './navigation';

describe('navAreas', () => {
  it.each(Object.entries(navAreas))('%s has at most 5 bottom-bar items', (_, area) => {
    const primary = area.items.filter((item) => item.primary);
    expect(primary.length).toBeGreaterThan(0);
    expect(primary.length).toBeLessThanOrEqual(5);
  });

  it.each(Object.entries(navAreas))('%s has unique paths', (_, area) => {
    const paths = area.items.map((item) => item.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

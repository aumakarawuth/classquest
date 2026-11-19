import { moveItem, resourceFormSchema, youtubeId } from './resources';

const base = { title: '', url: '', content: '' };

it('extracts YouTube ids from common URL shapes', () => {
  expect(youtubeId('https://www.youtube.com/watch?v=abc123')).toBe('abc123');
  expect(youtubeId('https://youtu.be/xyz')).toBe('xyz');
  expect(youtubeId('https://www.youtube.com/shorts/s1')).toBe('s1');
  expect(youtubeId('not a url')).toBeNull();
});

it('rejects non-https and wrong hosts', () => {
  const http = resourceFormSchema.safeParse({
    ...base,
    type: 'external',
    url: 'http://example.com',
  });
  expect(http.error?.issues[0]?.message).toBe('ลิงก์ต้องขึ้นต้นด้วย https://');
  const js = resourceFormSchema.safeParse({
    ...base,
    type: 'external',
    url: 'javascript:alert(1)',
  });
  expect(js.success).toBe(false);
  const lab = resourceFormSchema.safeParse({
    ...base,
    type: 'lab',
    url: 'https://evil.example/wokwi',
  });
  expect(lab.error?.issues[0]?.message).toBe('ลิงก์ต้องมาจาก wokwi.com');
});

it('accepts valid resources', () => {
  expect(
    resourceFormSchema.safeParse({ ...base, type: 'youtube', url: 'https://youtu.be/abc' }).success,
  ).toBe(true);
  expect(
    resourceFormSchema.safeParse({ ...base, type: 'code', content: 'void setup() {}' }).success,
  ).toBe(true);
  expect(resourceFormSchema.safeParse({ ...base, type: 'code', content: '  ' }).success).toBe(
    false,
  );
});

it('moves items within bounds', () => {
  expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
  expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
});

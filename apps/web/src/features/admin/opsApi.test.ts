import { formatBytes, parseDomains } from './opsApi';

it('formats bytes', () => {
  expect(formatBytes(512)).toBe('512 B');
  expect(formatBytes(1536)).toBe('1.5 KB');
  expect(formatBytes(524288000)).toBe('500 MB');
});

it('parses allowed email domains', () => {
  expect(parseDomains('School.ac.th, school.ac.th\nstudent.school.ac.th @bad x')).toEqual({
    domains: ['school.ac.th', 'student.school.ac.th'],
    invalid: ['@bad', 'x'],
  });
});

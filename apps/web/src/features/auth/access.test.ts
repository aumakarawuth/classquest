import { canAccessArea, defaultArea, type Account } from './access';

const base: Account = {
  id: '1',
  email: 'a@school.test',
  displayName: 'A',
  status: 'active',
  roles: [],
};

it('pending or suspended accounts get no area', () => {
  expect(defaultArea({ ...base, status: 'pending', roles: ['admin'] })).toBeNull();
  expect(canAccessArea({ ...base, status: 'suspended', roles: ['teacher'] }, 'teacher')).toBe(
    false,
  );
});

it('active account without role gets no area', () => {
  expect(defaultArea(base)).toBeNull();
});

it('lands teachers on the teacher area (even admins), others by role', () => {
  expect(defaultArea({ ...base, roles: ['admin', 'teacher'] })).toBe('teacher');
  expect(defaultArea({ ...base, roles: ['admin'] })).toBe('admin');
  expect(defaultArea({ ...base, roles: ['student', 'teacher'] })).toBe('teacher');
  expect(defaultArea({ ...base, roles: ['student'] })).toBe('student');
});

it('student cannot open teacher or admin areas', () => {
  const student = { ...base, roles: ['student' as const] };
  expect(canAccessArea(student, 'student')).toBe(true);
  expect(canAccessArea(student, 'teacher')).toBe(false);
  expect(canAccessArea(student, 'admin')).toBe(false);
});

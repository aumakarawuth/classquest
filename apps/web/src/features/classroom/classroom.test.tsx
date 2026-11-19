import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import * as coursesApi from '@/features/courses/api';
import * as api from './api';
import ClassroomPage from './pages/ClassroomPage';

vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  getConnection: vi.fn(),
  saveConnection: vi.fn(),
  listInvites: vi.fn(),
  importRoster: vi.fn(),
}));
vi.mock('@/features/courses/api', async (orig) => ({
  ...(await orig<typeof import('@/features/courses/api')>()),
  listMyCourses: vi.fn(),
}));

const auth: AuthState = {
  ready: true,
  configured: true,
  userId: 't1',
  account: {
    id: 't1',
    email: 't@school.test',
    displayName: 'T',
    status: 'active',
    roles: ['teacher'],
  },
  accountError: false,
  signIn: vi.fn(),
  signOut: vi.fn(),
  refetchAccount: vi.fn(),
};

it('saves a Classroom link and imports a roster CSV with preview', async () => {
  vi.mocked(coursesApi.listMyCourses).mockResolvedValue([
    {
      id: 'c1',
      code: '31910-2012',
      name: 'IoT',
      level: 'pvs',
      classroom: '',
      term: 1,
      academicYear: 2569,
      description: null,
      status: 'published',
      weeks: 18,
      createdAt: '',
    },
  ]);
  vi.mocked(api.getConnection).mockResolvedValue(null);
  vi.mocked(api.saveConnection).mockResolvedValue();
  vi.mocked(api.listInvites).mockResolvedValue([]);
  vi.mocked(api.importRoster).mockResolvedValue({ invited: 2, enrolled_now: 0, invalid: 0 });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { container } = render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter>
          <ClassroomPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );

  const input = await screen.findByLabelText('ลิงก์ Google Classroom');
  await userEvent.type(input, 'https://example.com');
  expect(screen.getByRole('button', { name: 'บันทึก' })).toBeDisabled();
  await userEvent.clear(input);
  await userEvent.type(input, 'https://classroom.google.com/c/abc');
  await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
  expect(api.saveConnection).toHaveBeenCalledWith('c1', 'https://classroom.google.com/c/abc', 't1');

  const file = new File(
    ['อีเมล,รหัสนักเรียน\na@school.test,66001\nb@school.test,66002\nbad,66003'],
    'roster.csv',
    { type: 'text/csv' },
  );
  await userEvent.upload(screen.getByLabelText('เลือกไฟล์ CSV'), file);
  expect(await screen.findByText(/ข้าม 1 แถว/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'นำเข้า' }));
  expect(api.importRoster).toHaveBeenCalledWith('c1', [
    { email: 'a@school.test', student_code: '66001', display_name: '' },
    { email: 'b@school.test', student_code: '66002', display_name: '' },
  ]);
  expect((await axe(container)).violations).toEqual([]);
});

it('builds gradebook rows with identity columns and optional XP', () => {
  const rows = api.gradebookRows(
    {
      items: [{ id: 'q1', type: 'quest', title: 'Mission 01', max: 10 }],
      students: [
        {
          user_id: 's',
          email: 'a@x.co',
          display_name: 'ก',
          student_code: '1',
          xp: 50,
          scores: { q1: 8 },
        },
      ],
    },
    true,
  );
  expect(rows).toEqual([
    ['Email', 'ชื่อ', 'รหัสนักเรียน', 'Mission 01 (10)', 'XP (ไม่ใช่คะแนน)'],
    ['a@x.co', 'ก', '1', 8, 50],
  ]);
});

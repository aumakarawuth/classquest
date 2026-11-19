import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import * as api from './api';
import CourseFormPage from './pages/CourseFormPage';
import StudentCoursesPage from './pages/StudentCoursesPage';

vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  listMyCourses: vi.fn(),
  joinCourse: vi.fn(),
  createCourse: vi.fn(),
}));

const auth = (role: 'teacher' | 'student'): AuthState => ({
  ready: true,
  configured: true,
  userId: 'u1',
  account: { id: 'u1', email: 'u@school.test', displayName: 'U', status: 'active', roles: [role] },
  accountError: false,
  signIn: vi.fn(),
  signOut: vi.fn(),
  refetchAccount: vi.fn(),
});

function renderWith(ui: React.ReactElement, role: 'teacher' | 'student') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={auth(role)}>
        <MemoryRouter>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

it('student joins a course with a normalised code', async () => {
  vi.mocked(api.listMyCourses).mockResolvedValue([]);
  vi.mocked(api.joinCourse).mockResolvedValue('c1');
  const { container } = renderWith(<StudentCoursesPage />, 'student');
  expect(await screen.findByText('ยังไม่ได้เข้าร่วมรายวิชา')).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('เข้าร่วมรายวิชาด้วยรหัส'), ' k7qx3mpa ');
  await userEvent.click(screen.getByRole('button', { name: 'เข้าร่วม' }));
  expect(api.joinCourse).toHaveBeenCalledWith('K7QX3MPA');
  expect((await axe(container)).violations).toEqual([]);
});

it('shows a Thai error for an invalid code', async () => {
  vi.mocked(api.listMyCourses).mockResolvedValue([]);
  vi.mocked(api.joinCourse).mockRejectedValue({ message: 'CQ_INVALID_CODE' });
  renderWith(<StudentCoursesPage />, 'student');
  await userEvent.type(await screen.findByLabelText('เข้าร่วมรายวิชาด้วยรหัส'), 'ABCDEFGH');
  await userEvent.click(screen.getByRole('button', { name: 'เข้าร่วม' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('รหัสไม่ถูกต้อง');
});

it('course form validates before submitting', async () => {
  const { container } = renderWith(<CourseFormPage />, 'teacher');
  await userEvent.click(screen.getByRole('button', { name: 'สร้างรายวิชา' }));
  expect(await screen.findByText('กรุณากรอกรหัสวิชา')).toBeInTheDocument();
  expect(screen.getByLabelText('รหัสวิชา')).toHaveAttribute('aria-invalid', 'true');
  expect(api.createCourse).not.toHaveBeenCalled();
  expect((await axe(container)).violations).toEqual([]);
});

it('course form submits typed values', async () => {
  vi.mocked(api.createCourse).mockResolvedValue('new-id');
  renderWith(<CourseFormPage />, 'teacher');
  await userEvent.type(screen.getByLabelText('รหัสวิชา'), '31910-2012');
  await userEvent.type(screen.getByLabelText('ชื่อรายวิชา'), 'อินเทอร์เน็ตเพื่อสรรพสิ่ง');
  await userEvent.selectOptions(screen.getByLabelText('ระดับชั้น'), 'pvs');
  await userEvent.click(screen.getByRole('button', { name: 'สร้างรายวิชา' }));
  expect(api.createCourse).toHaveBeenCalledWith(
    'u1',
    expect.objectContaining({
      code: '31910-2012',
      level: 'pvs',
      weeks: 18,
      term: expect.any(Number),
    }),
  );
});

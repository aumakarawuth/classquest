import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import * as coursesApi from '@/features/courses/api';
import * as api from './badgeApi';
import AchievementsPage from './pages/AchievementsPage';
import CourseBadgesPage from './pages/CourseBadgesPage';

vi.mock('./badgeApi', async (orig) => ({
  ...(await orig<typeof import('./badgeApi')>()),
  listBadges: vi.fn(),
  listMyBadges: vi.fn(),
  listCourseAwards: vi.fn(),
  listCourseStudents: vi.fn(),
  awardBadge: vi.fn(),
  createCourseBadge: vi.fn(),
}));
vi.mock('@/features/courses/api', async (orig) => ({
  ...(await orig<typeof import('@/features/courses/api')>()),
  listMyCourses: vi.fn(),
}));

const auth: AuthState = {
  ready: true,
  configured: true,
  userId: 'u1',
  account: {
    id: 'u1',
    email: 'u@school.test',
    displayName: 'U',
    status: 'active',
    roles: ['student', 'teacher'],
  },
  accountError: false,
  signIn: vi.fn(),
  signOut: vi.fn(),
  refetchAccount: vi.fn(),
};
const badges: api.Badge[] = [
  {
    id: 'b1',
    course_id: null,
    name: 'ก้าวแรก',
    description: 'เรียนบทเรียนแรกจบ',
    icon: 'rocket',
    xp_bonus: 10,
    rule: { type: 'lessons_completed', count: 1 },
    active: true,
  },
  {
    id: 'b2',
    course_id: 'c1',
    name: 'ช่วยเหลือเพื่อน',
    description: '',
    icon: 'star',
    xp_bonus: 15,
    rule: null,
    active: true,
  },
];

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/student/achievements" element={<AchievementsPage />} />
            <Route path="/teacher/courses/:courseId/badges" element={<CourseBadgesPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

it('achievements page shows earned and locked badges per course', async () => {
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
  vi.mocked(api.listBadges).mockResolvedValue(badges);
  vi.mocked(api.listMyBadges).mockResolvedValue([
    {
      id: 'e1',
      badge_id: 'b1',
      course_id: 'c1',
      user_id: 'u1',
      reason: '',
      created_at: '2026-11-19T03:00:00Z',
    },
  ]);
  const { container } = renderAt('/student/achievements');
  expect(await screen.findByText('1/2')).toBeInTheDocument();
  expect(screen.getByText(/ได้รับแล้ว · \+10 XP/)).toBeInTheDocument();
  expect(screen.getByText(/ครูเป็นผู้มอบ · \+15 XP/)).toBeInTheDocument();
  expect((await axe(container)).violations).toEqual([]);
});

it('teacher awards a manual badge to a chosen student', async () => {
  vi.mocked(api.listBadges).mockResolvedValue(badges);
  vi.mocked(api.listCourseAwards).mockResolvedValue([]);
  vi.mocked(api.listCourseStudents).mockResolvedValue([{ id: 's1', name: 'นักเรียน ก' }]);
  vi.mocked(api.awardBadge).mockResolvedValue(true);
  const { container } = renderAt('/teacher/courses/c1/badges');
  const buttons = await screen.findAllByRole('button', { name: 'มอบให้นักเรียน' });
  await userEvent.click(buttons[1] as HTMLElement);
  await userEvent.selectOptions(screen.getByLabelText('นักเรียน'), 's1');
  await userEvent.type(screen.getByLabelText('เหตุผล'), 'ช่วยเพื่อนต่อวงจร');
  await userEvent.click(screen.getByRole('button', { name: 'มอบ' }));
  expect(api.awardBadge).toHaveBeenCalledWith('b2', 's1', 'c1', 'ช่วยเพื่อนต่อวงจร');
  expect((await axe(container)).violations).toEqual([]);
});

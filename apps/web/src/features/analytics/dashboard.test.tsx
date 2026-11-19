import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import * as coursesApi from '@/features/courses/api';
import * as learningApi from '@/features/learning/api';
import * as api from './api';
import TeacherDashboardPage from './pages/TeacherDashboardPage';

vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  getDashboard: vi.fn(),
}));
vi.mock('@/features/courses/api', async (orig) => ({
  ...(await orig<typeof import('@/features/courses/api')>()),
  listMyCourses: vi.fn(),
}));
vi.mock('@/features/learning/api', async (orig) => ({
  ...(await orig<typeof import('@/features/learning/api')>()),
  getBuilder: vi.fn(),
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

it('shows real metrics, “–” for missing data and the support list', async () => {
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
  vi.mocked(learningApi.getBuilder).mockResolvedValue([]);
  vi.mocked(api.getDashboard).mockResolvedValue({
    students_total: 2,
    active_7d: 1,
    lessons_total: 2,
    quests_total: 0,
    lesson_completion_rate: 50,
    quest_completion_rate: null,
    pending_reviews: 3,
    avg_quest_pct: null,
    avg_quiz_pct: null,
    pretest_mean: null,
    posttest_mean: null,
    competency_pass_rate: null,
    competency_assessed_rate: null,
    students: [
      {
        user_id: 's2',
        display_name: 'นักเรียน ข',
        student_code: null,
        last_active: null,
        lessons_done: 0,
        quests_approved: 0,
        needs_revision: 0,
        avg_quest_pct: null,
        avg_quiz_pct: null,
        xp: 0,
        competencies_developing: 0,
        flags: ['inactive_7d'],
      },
      {
        user_id: 's1',
        display_name: 'นักเรียน ก',
        student_code: '66001',
        last_active: '2026-11-19',
        lessons_done: 2,
        quests_approved: 0,
        needs_revision: 0,
        avg_quest_pct: null,
        avg_quiz_pct: null,
        xp: 20,
        competencies_developing: 0,
        flags: [],
      },
    ],
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { container } = render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter>
          <TeacherDashboardPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  expect(await screen.findByText('50%')).toBeInTheDocument();
  expect(api.getDashboard).toHaveBeenCalledWith('c1', null, null);
  expect(screen.getByText('ไม่ได้เข้าเรียน 7 วัน')).toBeInTheDocument();
  expect(screen.getByText('– → –')).toBeInTheDocument();
  expect(screen.getByRole('rowheader', { name: /นักเรียน ก/ })).toBeInTheDocument();
  expect((await axe(container)).violations).toEqual([]);
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import * as analytics from '@/features/analytics/api';
import * as assessment from '@/features/assessment/api';
import * as coursesApi from '@/features/courses/api';
import * as questsApi from '@/features/quests/api';
import * as api from './api';
import GradebookPage from './pages/GradebookPage';
import StudentsPage from './pages/StudentsPage';

vi.mock('./api', async (o) => ({
  ...(await o<typeof import('./api')>()),
  listRoster: vi.fn(),
  removeFromCourse: vi.fn(),
  getGrades: vi.fn(),
}));
vi.mock('@/features/courses/api', async (o) => ({
  ...(await o<typeof import('@/features/courses/api')>()),
  listMyCourses: vi.fn(),
}));
vi.mock('@/features/analytics/api', async (o) => ({
  ...(await o<typeof import('@/features/analytics/api')>()),
  getDashboard: vi.fn(),
}));
vi.mock('@/features/quests/api', async (o) => ({
  ...(await o<typeof import('@/features/quests/api')>()),
  listCourseQuests: vi.fn(),
}));
vi.mock('@/features/assessment/api', async (o) => ({
  ...(await o<typeof import('@/features/assessment/api')>()),
  listQuizzes: vi.fn(),
}));

const auth = {
  ready: true,
  configured: true,
  userId: 't1',
  account: { id: 't1', email: 't@s.test', displayName: 'T', status: 'active', roles: ['teacher'] },
  accountError: false,
  signIn: vi.fn(),
  signOut: vi.fn(),
  refetchAccount: vi.fn(),
} as AuthState;

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(coursesApi.listMyCourses).mockResolvedValue([
    {
      id: 'c1',
      code: 'IOT',
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
  vi.mocked(api.listRoster).mockResolvedValue([
    { id: 's1', name: 'นักเรียน ก', email: 'a@s.test', studentCode: '66001', joinedAt: '' },
  ]);
});

it('lists students with progress and removes only after confirmation', async () => {
  vi.mocked(analytics.getDashboard).mockResolvedValue({
    students_total: 1,
    active_7d: 1,
    lessons_total: 3,
    quests_total: 2,
    lesson_completion_rate: null,
    quest_completion_rate: null,
    pending_reviews: 0,
    avg_quest_pct: null,
    avg_quiz_pct: null,
    pretest_mean: null,
    posttest_mean: null,
    competency_pass_rate: null,
    competency_assessed_rate: null,
    students: [
      {
        user_id: 's1',
        display_name: 'นักเรียน ก',
        student_code: '66001',
        last_active: null,
        lessons_done: 2,
        quests_approved: 1,
        needs_revision: 0,
        avg_quest_pct: null,
        avg_quiz_pct: null,
        xp: 120,
        competencies_developing: 0,
        flags: ['low_quiz'],
      },
    ],
  });
  vi.mocked(api.removeFromCourse).mockResolvedValue();
  const { container } = wrap(<StudentsPage />);
  const row = (await screen.findByRole('rowheader', { name: /นักเรียน ก/ })).closest(
    'tr',
  ) as HTMLElement;
  expect(await within(row).findByText('2/3')).toBeInTheDocument();
  expect(within(row).getByText('คะแนนแบบทดสอบต่ำกว่า 50%')).toBeInTheDocument();
  expect((await axe(container)).violations).toEqual([]);
  await userEvent.click(within(row).getByRole('button', { name: 'นำ นักเรียน ก ออกจากรายวิชา' }));
  expect(api.removeFromCourse).not.toHaveBeenCalled();
  await userEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', { name: 'นำออก' }),
  );
  expect(api.removeFromCourse).toHaveBeenCalledWith('c1', 's1');
});

it('shows stored scores in the gradebook', async () => {
  vi.mocked(questsApi.listCourseQuests).mockResolvedValue([
    { id: 'q1', title: 'Mission 01', published: true, max_score: 10 } as questsApi.Quest,
  ]);
  vi.mocked(assessment.listQuizzes).mockResolvedValue([]);
  vi.mocked(api.getGrades).mockResolvedValue(
    new Map([['q1:s1', { score: 8, max: 10, status: 'approved' }]]),
  );
  const { container } = wrap(<GradebookPage />);
  expect(await screen.findByText('8/10')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'ส่งออก CSV' })).toBeInTheDocument();
  expect((await axe(container)).violations).toEqual([]);
});

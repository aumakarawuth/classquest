import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import * as coursesApi from '@/features/courses/api';
import * as api from './api';
import LessonViewerPage from './pages/LessonViewerPage';
import StudentCoursePage from './pages/StudentCoursePage';
import * as studentApi from './studentApi';

vi.mock('./studentApi', async (orig) => ({
  ...(await orig<typeof import('./studentApi')>()),
  getRoadmapData: vi.fn(),
  completeLesson: vi.fn(),
}));
vi.mock('@/features/gamification/api', async (orig) => ({
  ...(await orig<typeof import('@/features/gamification/api')>()),
  getMyProgress: vi.fn().mockResolvedValue({
    xp: 130,
    level: 2,
    level_title: 'Explorer',
    level_floor: 100,
    next_threshold: 250,
  }),
}));
vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  getLesson: vi.fn(),
}));
vi.mock('@/features/courses/api', async (orig) => ({
  ...(await orig<typeof import('@/features/courses/api')>()),
  getCourse: vi.fn(),
}));

const auth: AuthState = {
  ready: true,
  configured: true,
  userId: 's1',
  account: {
    id: 's1',
    email: 's@school.test',
    displayName: 'S',
    status: 'active',
    roles: ['student'],
  },
  accountError: false,
  signIn: vi.fn(),
  signOut: vi.fn(),
  refetchAccount: vi.fn(),
};

const units = [
  {
    id: 'u1',
    position: 1,
    title: 'สัปดาห์ที่ 1',
    lessons: [
      {
        id: 'l1',
        title: 'IoT คืออะไร',
        position: 1,
        quest_stage: 'question' as const,
        prerequisite_lesson_id: null,
        estimated_minutes: 30,
      },
      {
        id: 'l2',
        title: 'Hello Arduino',
        position: 2,
        quest_stage: null,
        prerequisite_lesson_id: 'l1',
        estimated_minutes: null,
      },
    ],
  },
];

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/student/courses/:courseId" element={<StudentCoursePage />} />
            <Route
              path="/student/courses/:courseId/lessons/:lessonId"
              element={<LessonViewerPage />}
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(coursesApi.getCourse).mockResolvedValue({
    id: 'c1',
    code: '31910-2012',
    name: 'อินเทอร์เน็ตเพื่อสรรพสิ่ง',
    level: 'pvs',
    classroom: '',
    term: 1,
    academicYear: 2569,
    description: null,
    status: 'published',
    weeks: 18,
    createdAt: '2026-11-19T00:00:00Z',
  });
});

it('roadmap shows progress, next lesson and locked lessons', async () => {
  vi.mocked(studentApi.getRoadmapData).mockResolvedValue({ units, completedIds: new Set() });
  const { container } = renderAt('/student/courses/c1');
  expect(await screen.findByRole('link', { name: /เริ่มเรียน: IoT คืออะไร/ })).toBeInTheDocument();
  expect(screen.getByText(/ล็อกอยู่ — เรียน “IoT คืออะไร” ก่อน/)).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Hello Arduino/ })).not.toBeInTheDocument();
  expect(await screen.findByRole('progressbar', { name: 'ความคืบหน้าสู่เลเวล 3' })).toHaveAttribute(
    'aria-valuenow',
    '30',
  );
  expect((await axe(container)).violations).toEqual([]);
});

it('lesson viewer marks a lesson complete via the server', async () => {
  vi.mocked(studentApi.getRoadmapData).mockResolvedValue({ units, completedIds: new Set() });
  vi.mocked(studentApi.completeLesson).mockResolvedValue();
  vi.mocked(api.getLesson).mockResolvedValue({
    id: 'l1',
    course_id: 'c1',
    unit_id: 'u1',
    title: 'IoT คืออะไร',
    body_md: '## สถานการณ์ปัญหา',
    quest_stage: 'question',
    prerequisite_lesson_id: null,
    estimated_minutes: 30,
    published: true,
    lesson_resources: [],
  });
  const { container } = renderAt('/student/courses/c1/lessons/l1');
  expect(await screen.findByRole('heading', { name: 'สถานการณ์ปัญหา' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'ทำเครื่องหมายว่าเรียนจบ' }));
  expect(studentApi.completeLesson).toHaveBeenCalledWith('l1');
  expect((await axe(container)).violations).toEqual([]);
});

it('locked lesson shows the unlock condition instead of content', async () => {
  vi.mocked(studentApi.getRoadmapData).mockResolvedValue({ units, completedIds: new Set() });
  vi.mocked(api.getLesson).mockResolvedValue({
    id: 'l2',
    course_id: 'c1',
    unit_id: 'u1',
    title: 'Hello Arduino',
    body_md: 'SECRET',
    quest_stage: null,
    prerequisite_lesson_id: 'l1',
    estimated_minutes: null,
    published: true,
    lesson_resources: [],
  });
  renderAt('/student/courses/c1/lessons/l2');
  expect(await screen.findByText('บทเรียนนี้ยังล็อกอยู่')).toBeInTheDocument();
  expect(screen.queryByText('SECRET')).not.toBeInTheDocument();
});

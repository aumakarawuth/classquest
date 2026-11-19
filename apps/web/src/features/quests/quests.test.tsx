import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import * as learningApi from '@/features/learning/api';
import * as api from './api';
import QuestBoardPage from './pages/QuestBoardPage';
import QuestDetailPage from './pages/QuestDetailPage';
import QuestEditorPage from './pages/QuestEditorPage';

vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  listStudentQuests: vi.fn(),
  listMySubmissions: vi.fn(),
  submitQuest: vi.fn(),
  uploadSubmissionFile: vi.fn(),
  listCourseQuests: vi.fn(),
  saveQuest: vi.fn(),
}));
vi.mock('@/features/learning/api', async (orig) => ({
  ...(await orig<typeof import('@/features/learning/api')>()),
  getBuilder: vi.fn(),
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

const quest = (id: string, title: string, extra: Partial<api.Quest> = {}) => ({
  id,
  course_id: 'c1',
  unit_id: null,
  type: 'main' as const,
  title,
  description_md: '## โจทย์',
  objectives: 'ต่อวงจร LED',
  quest_stage: 'experiment' as const,
  difficulty: 2,
  max_score: 10,
  xp_reward: 150,
  due_at: null,
  allow_late: true,
  submit_modes: ['text', 'url', 'file'] as api.Quest['submit_modes'],
  classroom_url: null,
  max_attempts: 2,
  position: 1,
  published: true,
  quest_prerequisites: [],
  courses: { code: '31910-2012', name: 'IoT' },
  ...extra,
});

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/student/quests" element={<QuestBoardPage />} />
            <Route path="/student/quests/:questId" element={<QuestDetailPage />} />
            <Route
              path="/teacher/courses/:courseId/quests/:questId"
              element={<QuestEditorPage />}
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

it('board groups quests by state', async () => {
  vi.mocked(api.listStudentQuests).mockResolvedValue([
    quest('q1', 'Mission 01'),
    quest('q2', 'Mission 02', { quest_prerequisites: [{ required_quest_id: 'q1' }] }),
    quest('q3', 'Boss', { type: 'boss' }),
  ]);
  vi.mocked(api.listMySubmissions).mockResolvedValue([
    {
      id: 's',
      quest_id: 'q3',
      attempt_no: 1,
      content_text: 'x',
      url: null,
      storage_path: null,
      status: 'submitted',
      is_late: false,
      submitted_at: '2026-11-19T00:00:00Z',
    },
  ]);
  const { container } = renderAt('/student/quests');
  expect(await screen.findByText('Mission 01')).toBeInTheDocument();
  expect(screen.queryByText('Mission 02')).not.toBeInTheDocument(); // locked → not in "ต้องทำ"
  await userEvent.click(screen.getByRole('tab', { name: /รอตรวจ/ }));
  expect(screen.getByText('Boss')).toBeInTheDocument();
  expect((await axe(container)).violations).toEqual([]);
});

it('detail submits text and URL through the RPC', async () => {
  vi.mocked(api.listStudentQuests).mockResolvedValue([quest('q1', 'Mission 01')]);
  vi.mocked(api.listMySubmissions).mockResolvedValue([]);
  vi.mocked(api.submitQuest).mockResolvedValue();
  const { container } = renderAt('/student/quests/q1');
  await userEvent.type(await screen.findByLabelText('คำตอบ'), 'ต่อ LED ที่ขา 13');
  await userEvent.type(screen.getByLabelText('ลิงก์ผลงาน'), 'https://wokwi.com/projects/1');
  await userEvent.click(screen.getByRole('button', { name: 'ส่งงาน' }));
  expect(api.submitQuest).toHaveBeenCalledWith(
    'q1',
    'ต่อ LED ที่ขา 13',
    'https://wokwi.com/projects/1',
    null,
  );
  expect(api.uploadSubmissionFile).not.toHaveBeenCalled();
  expect((await axe(container)).violations).toEqual([]);
});

it('rejects oversized files before upload', async () => {
  vi.mocked(api.listStudentQuests).mockResolvedValue([quest('q1', 'Mission 01')]);
  vi.mocked(api.listMySubmissions).mockResolvedValue([]);
  renderAt('/student/quests/q1');
  const big = new File([new Uint8Array(3 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' });
  await userEvent.upload(await screen.findByLabelText(/ไฟล์/), big);
  expect(screen.getByRole('alert')).toHaveTextContent('2 MB');
});

it('editor requires a Classroom link when classroom mode is chosen', async () => {
  vi.mocked(learningApi.getBuilder).mockResolvedValue([]);
  vi.mocked(api.listCourseQuests).mockResolvedValue([]);
  const { container } = renderAt('/teacher/courses/c1/quests/new');
  await userEvent.type(await screen.findByLabelText('ชื่อภารกิจ'), 'Mission 03');
  await userEvent.click(screen.getByLabelText('ส่งใน Google Classroom'));
  await userEvent.click(screen.getByRole('button', { name: 'บันทึกภารกิจ' }));
  expect(await screen.findByText(/กรอกลิงก์งานใน Google Classroom/)).toBeInTheDocument();
  expect(api.saveQuest).not.toHaveBeenCalled();
  expect((await axe(container)).violations).toEqual([]);
});

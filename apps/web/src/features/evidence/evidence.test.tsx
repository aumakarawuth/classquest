import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import * as coursesApi from '@/features/courses/api';
import * as api from './api';
import EvidenceCenterPage from './pages/EvidenceCenterPage';
import SurveyPage from './pages/SurveyPage';

vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  listEvidence: vi.fn(),
  saveEvidence: vi.fn(),
  getSurvey: vi.fn(),
  submitSurvey: vi.fn(),
  listSurveys: vi.fn(),
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
    roles: ['teacher', 'student'],
  },
  accountError: false,
  signIn: vi.fn(),
  signOut: vi.fn(),
  refetchAccount: vi.fn(),
};
function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/teacher/evidence" element={<EvidenceCenterPage />} />
            <Route path="/student/surveys/:surveyId" element={<SurveyPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

it('evidence center lists 13 categories and saves evidence with https link only', async () => {
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
  vi.mocked(api.listEvidence).mockResolvedValue([]);
  vi.mocked(api.saveEvidence).mockResolvedValue();
  const { container } = renderAt('/teacher/evidence');
  const nav = await screen.findByRole('navigation', { name: 'หมวดหลักฐาน' });
  expect(nav.querySelectorAll('button')).toHaveLength(13);
  await userEvent.click(screen.getByRole('button', { name: 'เพิ่มหลักฐาน' }));
  await userEvent.type(screen.getByLabelText('ชื่อหลักฐาน'), 'แบบสำรวจปัญหาผู้เรียน');
  await userEvent.type(screen.getByLabelText('ลิงก์ไฟล์ (เช่น Google Drive)'), 'http://x');
  expect(screen.getByText('ลิงก์ต้องขึ้นต้นด้วย https://')).toBeInTheDocument();
  await userEvent.clear(screen.getByLabelText('ลิงก์ไฟล์ (เช่น Google Drive)'));
  await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
  expect(api.saveEvidence).toHaveBeenCalledWith(
    'c1',
    'u1',
    null,
    expect.objectContaining({ category: 'problem_needs', title: 'แบบสำรวจปัญหาผู้เรียน', url: null }),
  );
  expect((await axe(container)).violations).toEqual([]);
});

it('student must answer all Likert items before submitting', async () => {
  vi.mocked(api.getSurvey).mockResolvedValue({
    id: 's1',
    course_id: 'c1',
    title: 'ความพึงพอใจ',
    description: '',
    anonymous: true,
    open: true,
    items: [
      { id: 'q1', text: 'กิจกรรมสนุก', type: 'likert' },
      { id: 'q2', text: 'ข้อเสนอแนะ', type: 'text' },
    ],
  });
  vi.mocked(api.submitSurvey).mockResolvedValue();
  const { container } = renderAt('/student/surveys/s1');
  const submit = await screen.findByRole('button', { name: 'ส่งแบบประเมิน' });
  expect(submit).toBeDisabled();
  await userEvent.click(screen.getByLabelText('5 มากที่สุด'));
  await userEvent.click(submit);
  expect(api.submitSurvey).toHaveBeenCalledWith('s1', { q1: 5 });
  expect((await axe(container)).violations).toEqual([]);
});

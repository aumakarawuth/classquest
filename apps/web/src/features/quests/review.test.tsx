import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { RubricEditor } from './components/RubricEditor';
import ReviewDetailPage from './pages/ReviewDetailPage';
import * as reviewApi from './reviewApi';

vi.mock('@/features/competency/api', async (orig) => ({
  ...(await orig<typeof import('@/features/competency/api')>()),
  listCompetencies: vi.fn().mockResolvedValue([]),
}));
vi.mock('./reviewApi', async (orig) => ({
  ...(await orig<typeof import('./reviewApi')>()),
  getReviewSubmission: vi.fn(),
  reviewSubmission: vi.fn(),
  getRubricCriteria: vi.fn(),
  saveQuestRubric: vi.fn(),
}));

function renderWith(ui: React.ReactElement, path = '/', route = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={ui} />
          <Route path="/teacher/reviews" element={<p>QUEUE</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const detail = (criteria: reviewApi.RubricCriterion[]) => ({
  submission: {
    id: 'sub1',
    user_id: 's1',
    quest_id: 'q1',
    attempt_no: 1,
    content_text: 'ต่อ LED ขา 13',
    url: null,
    storage_path: null,
    status: 'submitted' as const,
    is_late: false,
    submitted_at: '2026-11-19T03:00:00Z',
    profiles: { display_name: 'นักเรียน ก' },
    quests: {
      id: 'q1',
      course_id: 'c1',
      title: 'Mission 03',
      description_md: '',
      max_score: 20,
      xp_reward: 150,
      rubric_id: criteria.length ? 'r1' : null,
    },
  },
  previous: [],
  reviews: [],
  criteria,
});

beforeEach(() => vi.clearAllMocks());

it('approves with rubric points and a stable idempotency key across retries', async () => {
  vi.mocked(reviewApi.getReviewSubmission).mockResolvedValue(
    detail([
      {
        id: 'k1',
        position: 1,
        name: 'วงจรถูกต้อง',
        description: '',
        max_points: 4,
        competency_id: null,
      },
      {
        id: 'k2',
        position: 2,
        name: 'โค้ดทำงาน',
        description: '',
        max_points: 4,
        competency_id: null,
      },
    ]),
  );
  vi.mocked(reviewApi.reviewSubmission)
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValueOnce();
  const { container } = renderWith(
    <ReviewDetailPage />,
    '/teacher/reviews/sub1',
    '/teacher/reviews/:submissionId',
  );

  await userEvent.type(await screen.findByLabelText(/วงจรถูกต้อง/), '4');
  await userEvent.type(screen.getByLabelText(/โค้ดทำงาน/), '3');
  expect(screen.getByText('คะแนนรวม 7/8 → 17.5/20')).toBeInTheDocument();
  expect((await axe(container)).violations).toEqual([]);

  await userEvent.click(screen.getByRole('button', { name: 'อนุมัติ (+150 XP)' }));
  await userEvent.click(screen.getByRole('button', { name: 'อนุมัติ (+150 XP)' }));
  const calls = vi.mocked(reviewApi.reviewSubmission).mock.calls;
  expect(calls).toHaveLength(2);
  expect(calls[0]?.[0]).toMatchObject({
    decision: 'approved',
    score: null,
    rubric: [
      { criterion_id: 'k1', points: 4 },
      { criterion_id: 'k2', points: 3 },
    ],
  });
  expect(calls[0]?.[0].idempotencyKey).toBe(calls[1]?.[0].idempotencyKey);
  expect(await screen.findByText('QUEUE')).toBeInTheDocument();
});

it('requests revision with feedback and direct score when no rubric', async () => {
  vi.mocked(reviewApi.getReviewSubmission).mockResolvedValue(detail([]));
  vi.mocked(reviewApi.reviewSubmission).mockResolvedValue();
  renderWith(<ReviewDetailPage />, '/teacher/reviews/sub1', '/teacher/reviews/:submissionId');
  await userEvent.type(await screen.findByLabelText('Feedback ถึงนักเรียน'), 'เพิ่มภาพวงจร');
  await userEvent.click(screen.getByRole('button', { name: 'ส่งกลับให้แก้ไข' }));
  expect(reviewApi.reviewSubmission).toHaveBeenCalledWith(
    expect.objectContaining({
      decision: 'needs_revision',
      feedback: 'เพิ่มภาพวงจร',
      rubric: null,
      score: null,
    }),
  );
});

it('rubric editor saves criteria and blocks invalid rows', async () => {
  vi.mocked(reviewApi.saveQuestRubric).mockResolvedValue();
  const { container } = renderWith(<RubricEditor questId="q1" rubricId={null} courseId="c1" />);
  await userEvent.click(screen.getByRole('button', { name: 'เพิ่มเกณฑ์' }));
  expect(screen.getByRole('button', { name: 'บันทึกเกณฑ์' })).toBeDisabled();
  await userEvent.type(screen.getByLabelText('ชื่อเกณฑ์ที่ 1'), 'วงจรถูกต้อง');
  await userEvent.click(screen.getByRole('button', { name: 'บันทึกเกณฑ์' }));
  expect(reviewApi.saveQuestRubric).toHaveBeenCalledWith('q1', [
    { name: 'วงจรถูกต้อง', description: '', max_points: 4, competency_id: null },
  ]);
  expect((await axe(container)).violations).toEqual([]);
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from 'vitest-axe';
import * as api from './attemptApi';
import AttemptResultPage from './pages/AttemptResultPage';
import TakeQuizPage from './pages/TakeQuizPage';

vi.mock('./attemptApi', async (orig) => ({
  ...(await orig<typeof import('./attemptApi')>()),
  submitAttempt: vi.fn(),
  getAttemptResult: vi.fn(),
}));

const payload: api.AttemptPayload = {
  attempt_id: 'a1',
  quiz_id: 'z1',
  deadline_at: null,
  status: 'in_progress',
  questions: [
    {
      id: 'q1',
      type: 'mc',
      stem: 'IoT ย่อมาจาก?',
      points: 1,
      options: [
        { id: 'o1', label: 'Internet of Things' },
        { id: 'o2', label: 'Input of Tools' },
      ],
    },
    { id: 'q2', type: 'short', stem: 'อธิบายเซนเซอร์', points: 2, options: [] },
  ],
};

function renderAt(path: string, state?: unknown) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[{ pathname: path, state }]}>
        <Routes>
          <Route path="/student/attempts/:attemptId" element={<TakeQuizPage />} />
          <Route path="/student/attempts/:attemptId/result" element={<AttemptResultPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

it('answers questions, keeps a local draft and submits after confirmation', async () => {
  vi.mocked(api.submitAttempt).mockResolvedValue({ status: 'submitted', score: 1, max_score: 3 });
  vi.mocked(api.getAttemptResult).mockResolvedValue({
    attempt_id: 'a1',
    quiz_id: 'z1',
    status: 'submitted',
    score: 1,
    max_score: 3,
    passing_percent: 50,
    submitted_at: null,
    answers_revealed: false,
    answers_visible_at: null,
    questions: [],
  });
  const { container } = renderAt('/student/attempts/a1', payload);
  await userEvent.click(screen.getByLabelText('Internet of Things'));
  await userEvent.type(screen.getByLabelText('คำตอบข้อ 2'), 'วัดค่าทางกายภาพ');
  expect(screen.getByText('ตอบแล้ว 2/2 ข้อ')).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('classquest.quiz-draft.a1') ?? '{}').q1.option_id).toBe(
    'o1',
  );
  expect((await axe(container)).violations).toEqual([]);

  await userEvent.click(screen.getByRole('button', { name: 'ส่งคำตอบ' }));
  expect(api.submitAttempt).not.toHaveBeenCalled();
  await userEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', { name: 'ส่งคำตอบ' }),
  );
  expect(api.submitAttempt).toHaveBeenCalledWith('a1', [
    { question_id: 'q1', option_id: 'o1' },
    { question_id: 'q2', text: 'วัดค่าทางกายภาพ' },
  ]);
  expect(await screen.findByText(/รอครูตรวจข้อเขียน/)).toBeInTheDocument();
  expect(screen.getByText('แบบทดสอบนี้ไม่แสดงเฉลย')).toBeInTheDocument();
});

it('without navigation state it asks the student to resume from the quiz page', () => {
  renderAt('/student/attempts/a1');
  expect(screen.getByText('ไม่พบข้อมูลการทำแบบทดสอบ')).toBeInTheDocument();
});

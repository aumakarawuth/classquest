import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from 'vitest-axe';
import * as api from './api';
import QuestionBankPage from './pages/QuestionBankPage';
import QuizEditorPage from './pages/QuizEditorPage';

vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  listQuestions: vi.fn(),
  saveQuestion: vi.fn(),
  saveQuiz: vi.fn(),
  setQuizQuestions: vi.fn(),
}));
vi.mock('@/features/competency/api', async (orig) => ({
  ...(await orig<typeof import('@/features/competency/api')>()),
  listCompetencies: vi.fn().mockResolvedValue([]),
}));

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/teacher/courses/:courseId/question-bank" element={<QuestionBankPage />} />
          <Route path="/teacher/courses/:courseId/quizzes/:quizId" element={<QuizEditorPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const bankQ: api.Question = {
  id: 'q1',
  type: 'mc',
  stem: 'ขา GPIO ใดต่อ LED?',
  explanation: '',
  points: 2,
  competency_id: null,
  bank_tag: 'หน่วย 1',
  question_options: [
    { id: 'o1', position: 1, label: '13', is_correct: true },
    { id: 'o2', position: 2, label: 'A0', is_correct: false },
  ],
};

beforeEach(() => vi.clearAllMocks());

it('creates an MC question with exactly one correct option', async () => {
  vi.mocked(api.listQuestions).mockResolvedValue([]);
  vi.mocked(api.saveQuestion).mockResolvedValue('new');
  const { container } = renderAt('/teacher/courses/c1/question-bank');
  await userEvent.click(await screen.findByRole('button', { name: 'เพิ่มคำถาม' }));
  await userEvent.type(screen.getByLabelText('คำถาม'), 'IoT ย่อมาจากอะไร');
  await userEvent.click(screen.getByRole('button', { name: 'บันทึกคำถาม' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('ตัวเลือก/คำตอบต้องไม่ว่าง');
  await userEvent.type(screen.getByLabelText('ตัวเลือก 1'), 'Internet of Things');
  await userEvent.type(screen.getByLabelText('ตัวเลือก 2'), 'Input of Tools');
  await userEvent.click(screen.getByRole('button', { name: 'บันทึกคำถาม' }));
  expect(api.saveQuestion).toHaveBeenCalledWith(
    'c1',
    null,
    expect.objectContaining({
      type: 'mc',
      options: [
        { label: 'Internet of Things', is_correct: true },
        { label: 'Input of Tools', is_correct: false },
      ],
    }),
  );
  expect((await axe(container)).violations).toEqual([]);
});

it('quiz editor saves settings and question order', async () => {
  vi.mocked(api.listQuestions).mockResolvedValue([bankQ]);
  vi.mocked(api.saveQuiz).mockResolvedValue('z1');
  vi.mocked(api.setQuizQuestions).mockResolvedValue();
  const { container } = renderAt('/teacher/courses/c1/quizzes/new');
  await userEvent.type(await screen.findByLabelText('ชื่อแบบทดสอบ'), 'Pre-test IoT');
  await userEvent.selectOptions(screen.getByLabelText('ประเภท'), 'pretest');
  await userEvent.click(screen.getByText(/เพิ่มจากคลังข้อสอบ/));
  await userEvent.click(screen.getByRole('button', { name: /ขา GPIO ใดต่อ LED/ }));
  expect(screen.getByText('คำถามในแบบทดสอบ (1 ข้อ, 2 คะแนน)')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'บันทึกแบบทดสอบ' }));
  expect(api.saveQuiz).toHaveBeenCalledWith(
    'c1',
    null,
    expect.objectContaining({ title: 'Pre-test IoT', kind: 'pretest' }),
  );
  expect(api.setQuizQuestions).toHaveBeenCalledWith('z1', ['q1']);
  expect((await axe(container)).violations).toEqual([]);
});

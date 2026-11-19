import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from 'vitest-axe';
import * as api from './api';
import PrePostReportPage from './pages/PrePostReportPage';
import * as pp from './prepost';

vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  listQuizzes: vi.fn(),
}));
vi.mock('./prepost', async (orig) => ({
  ...(await orig<typeof import('./prepost')>()),
  getPrePostReport: vi.fn(),
}));

const quiz = (id: string, kind: api.QuizKind, title: string): api.Quiz => ({
  id,
  course_id: 'c1',
  unit_id: null,
  kind,
  title,
  description: '',
  time_limit_minutes: null,
  shuffle_questions: true,
  shuffle_options: true,
  questions_per_attempt: null,
  max_attempts: 1,
  available_from: null,
  available_until: null,
  answers_visible_at: null,
  passing_percent: 50,
  xp_reward: 0,
  published: true,
});

it('defaults to the pre/post quizzes, uses anonymized codes and shows paired statistics', async () => {
  vi.mocked(api.listQuizzes).mockResolvedValue([
    quiz('pre', 'pretest', 'Pre-test'),
    quiz('post', 'posttest', 'Post-test'),
  ]);
  vi.mocked(pp.getPrePostReport).mockResolvedValue([
    { student: 'S01', pre_percent: 40, post_percent: 80, gain: 40, normalized_gain: 0.667 },
    { student: 'S02', pre_percent: 60, post_percent: null, gain: null, normalized_gain: null },
  ]);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { container } = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/teacher/courses/c1/prepost']}>
        <Routes>
          <Route path="/teacher/courses/:courseId/prepost" element={<PrePostReportPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(await screen.findByText('1/2')).toBeInTheDocument();
  expect(pp.getPrePostReport).toHaveBeenCalledWith('c1', 'pre', 'post', true);
  expect(screen.getByRole('rowheader', { name: 'S02' })).toBeInTheDocument();
  expect((await axe(container)).violations).toEqual([]);
});

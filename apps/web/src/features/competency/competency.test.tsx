import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from 'vitest-axe';
import * as api from './api';
import CompetencyMatrixPage from './pages/CompetencyMatrixPage';
import StudentReportPage from './pages/StudentReportPage';

vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  listCompetencies: vi.fn(),
  getMatrix: vi.fn(),
  listEvidence: vi.fn(),
}));

const competencies: api.Competency[] = [
  {
    id: 'k1',
    course_id: 'c1',
    parent_id: null,
    code: 'C1',
    name: 'ต่อวงจร',
    description: '',
    pass_threshold: 60,
    position: 1,
  },
  {
    id: 'k2',
    course_id: 'c1',
    parent_id: null,
    code: 'C2',
    name: 'เขียนโปรแกรม',
    description: '',
    pass_threshold: 70,
    position: 2,
  },
];
const cell = (
  user: string,
  name: string,
  k: string,
  pct: number | null,
  passed: boolean | null,
): api.MatrixCell => ({
  user_id: user,
  display_name: name,
  competency_id: k,
  score_percent: pct,
  passed,
  evidence_count: pct === null ? 0 : 1,
  last_assessed_at: null,
});

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/teacher/courses/:courseId/competency-matrix"
            element={<CompetencyMatrixPage />}
          />
          <Route
            path="/teacher/courses/:courseId/competency/:userId"
            element={<StudentReportPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listCompetencies).mockResolvedValue(competencies);
});

it('matrix shows pass / developing / not assessed with text, and per-competency totals', async () => {
  vi.mocked(api.getMatrix).mockResolvedValue([
    cell('s1', 'นักเรียน ก', 'k1', 100, true),
    cell('s1', 'นักเรียน ก', 'k2', 50, false),
    cell('s2', 'นักเรียน ข', 'k1', null, null),
    cell('s2', 'นักเรียน ข', 'k2', null, null),
  ]);
  const { container } = renderAt('/teacher/courses/c1/competency-matrix');
  expect(await screen.findByText('ผ่าน 1/2 คน', { exact: false })).toBeInTheDocument();
  expect(screen.getByText('ต้องพัฒนา', { exact: false })).toBeInTheDocument();
  expect(screen.getAllByText('ยังไม่ประเมิน')).toHaveLength(2);
  expect(screen.getByRole('link', { name: 'นักเรียน ก' })).toHaveAttribute(
    'href',
    '/teacher/courses/c1/competency/s1',
  );
  expect((await axe(container)).violations).toEqual([]);
});

it('individual report lists evidence', async () => {
  vi.mocked(api.getMatrix).mockResolvedValue([
    cell('s1', 'ก', 'k1', 100, true),
    cell('s1', 'ก', 'k2', 50, false),
  ]);
  vi.mocked(api.listEvidence).mockResolvedValue([
    {
      id: 'e1',
      competency_id: 'k2',
      score_percent: 50,
      source_type: 'rubric',
      note: '',
      created_at: '2026-11-19T03:00:00Z',
    },
  ]);
  const { container } = renderAt('/teacher/courses/c1/competency/s1');
  expect(await screen.findByText('ผ่านแล้ว 1 จาก 2 สมรรถนะ')).toBeInTheDocument();
  expect(screen.getByText(/Rubric ภารกิจ · 50%/)).toBeInTheDocument();
  expect((await axe(container)).violations).toEqual([]);
});

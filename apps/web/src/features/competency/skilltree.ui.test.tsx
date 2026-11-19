import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import * as api from './api';
import { SkillTree } from './components/SkillTree';

vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  listCompetencies: vi.fn(),
  getMatrix: vi.fn(),
}));

it('renders a nested, accessible skill tree with statuses', async () => {
  vi.mocked(api.listCompetencies).mockResolvedValue([
    {
      id: 'k1',
      course_id: 'c',
      parent_id: null,
      code: 'C1',
      name: 'อิเล็กทรอนิกส์พื้นฐาน',
      description: '',
      pass_threshold: 60,
      position: 1,
    },
    {
      id: 'k2',
      course_id: 'c',
      parent_id: 'k1',
      code: 'C1.1',
      name: 'ต่อวงจร LED',
      description: '',
      pass_threshold: 60,
      position: 1,
    },
  ]);
  vi.mocked(api.getMatrix).mockResolvedValue([
    {
      user_id: 's',
      display_name: 's',
      competency_id: 'k1',
      score_percent: 80,
      passed: true,
      evidence_count: 1,
      last_assessed_at: null,
    },
    {
      user_id: 's',
      display_name: 's',
      competency_id: 'k2',
      score_percent: null,
      passed: null,
      evidence_count: 0,
      last_assessed_at: null,
    },
  ]);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { container } = render(
    <QueryClientProvider client={qc}>
      <SkillTree courseId="c" userId="s" />
    </QueryClientProvider>,
  );
  const nav = await screen.findByRole('navigation', { name: 'Skill Tree' });
  expect(nav.querySelectorAll('ul ul li')).toHaveLength(1);
  expect(screen.getByText('ต่อวงจร LED')).toBeInTheDocument();
  expect(screen.getByText('ยังไม่ประเมิน')).toBeInTheDocument();
  expect((await axe(container)).violations).toEqual([]);
});

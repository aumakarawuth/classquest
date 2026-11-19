import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import * as api from './api';
import { PortfolioView } from './components/PortfolioView';

vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  getPortfolio: vi.fn(),
  savePortfolioSettings: vi.fn(),
  featureWork: vi.fn(),
  addReflection: vi.fn(),
}));
vi.mock('@/features/competency/components/CompetencyReport', () => ({
  CompetencyReport: () => <p>รายงานสมรรถนะ</p>,
}));

const data: api.PortfolioData = {
  exists: false,
  visibility: 'private',
  headline: '',
  items: [],
  reflections: [],
  xp: 320,
  badges: [{ name: 'ก้าวแรก', icon: 'rocket', created_at: '2026-11-19T00:00:00Z' }],
  works: [
    {
      id: 'sub1',
      quest_id: 'q1',
      attempt_no: 1,
      content_text: 'บ้านอัจฉริยะ',
      url: null,
      storage_path: null,
      submitted_at: '2026-11-19T03:00:00Z',
      quests: { title: 'Boss Mission', type: 'boss' },
      quest_reviews: [{ score: 28, feedback: 'ยอดเยี่ยม' }],
    },
  ],
};

function renderView(editable: boolean) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <PortfolioView
          courseId="c1"
          userId="s1"
          courseTitle="31910-2012 IoT"
          studentName="นักเรียน ก"
          editable={editable}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

it('student pins approved work (creating a private portfolio) and writes a reflection', async () => {
  vi.mocked(api.getPortfolio).mockResolvedValue(data);
  vi.mocked(api.savePortfolioSettings).mockResolvedValue();
  vi.mocked(api.featureWork).mockResolvedValue();
  vi.mocked(api.addReflection).mockResolvedValue();
  const { container } = renderView(true);
  expect(await screen.findByLabelText('เฉพาะฉัน')).toBeChecked();
  await userEvent.click(screen.getByText(/งานที่ผ่านแล้ว/));
  await userEvent.click(screen.getByRole('button', { name: 'ปักหมุด' }));
  expect(api.savePortfolioSettings).toHaveBeenCalledWith('s1', 'c1', 'private', '');
  expect(api.featureWork).toHaveBeenCalledWith('s1', 'c1', 'sub1', 'Boss Mission', 1);
  await userEvent.type(screen.getByLabelText('สิ่งที่อยากบันทึก'), 'ได้ฝึกแก้ปัญหา');
  await userEvent.click(screen.getAllByRole('button', { name: 'บันทึก' }).at(-1) as HTMLElement);
  expect(api.addReflection).toHaveBeenCalledWith('s1', 'c1', expect.any(String), 'ได้ฝึกแก้ปัญหา');
  expect((await axe(container)).violations).toEqual([]);
});

it('read-only view has no editing controls', async () => {
  vi.mocked(api.getPortfolio).mockResolvedValue(data);
  renderView(false);
  expect(await screen.findByText('320')).toBeInTheDocument();
  expect(screen.queryByText('ใครเห็นแฟ้มนี้')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('สิ่งที่อยากบันทึก')).not.toBeInTheDocument();
});

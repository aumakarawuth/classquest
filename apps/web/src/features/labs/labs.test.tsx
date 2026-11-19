import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from 'vitest-axe';
import * as api from './api';
import LabDetailPage from './pages/LabDetailPage';

vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  getLab: vi.fn(),
  getWokwiEmbedEnabled: vi.fn(),
}));

const lab: api.Lab = {
  id: 'l1',
  course_id: 'c1',
  unit_id: null,
  quest_id: 'q3',
  title: 'LED Blink',
  project_url: 'https://wokwi.com/projects/322062421191557714',
  allow_embed: true,
  instructions_md: '1. ต่อ LED ที่ขา 13',
  diagram_url: null,
  source_code: 'void setup(){}',
  expected_result: 'LED กระพริบทุก 1 วินาที',
  components: ['Arduino', 'LED'],
  position: 1,
  published: true,
};

function renderLab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/student/labs/l1']}>
        <Routes>
          <Route path="/student/labs/:labId" element={<LabDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

it('links to Wokwi and to the evidence quest; no embed while the system flag is off', async () => {
  vi.mocked(api.getLab).mockResolvedValue(lab);
  vi.mocked(api.getWokwiEmbedEnabled).mockResolvedValue(false);
  const { container } = renderLab();
  expect(await screen.findByRole('link', { name: 'เปิดใน Wokwi' })).toHaveAttribute(
    'href',
    lab.project_url,
  );
  expect(screen.getByRole('link', { name: 'ส่งหลักฐานการทดลอง' })).toHaveAttribute(
    'href',
    '/student/quests/q3',
  );
  expect(screen.queryByTitle('Wokwi: LED Blink')).not.toBeInTheDocument();
  expect((await axe(container)).violations).toEqual([]);
});

it('embeds only when both the system and the lab allow it', async () => {
  vi.mocked(api.getLab).mockResolvedValue(lab);
  vi.mocked(api.getWokwiEmbedEnabled).mockResolvedValue(true);
  renderLab();
  expect(await screen.findByTitle('Wokwi: LED Blink')).toHaveAttribute('sandbox');
});

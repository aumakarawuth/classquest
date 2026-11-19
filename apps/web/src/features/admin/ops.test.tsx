import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import * as ops from './opsApi';
import QuotaPage from './pages/QuotaPage';
import SettingsPage from './pages/SettingsPage';

vi.mock('./opsApi', async (orig) => ({
  ...(await orig<typeof import('./opsApi')>()),
  getQuota: vi.fn(),
  listSettings: vi.fn(),
  updateSetting: vi.fn(),
}));

const auth: AuthState = {
  ready: true,
  configured: true,
  userId: 'a1',
  account: {
    id: 'a1',
    email: 'a@school.test',
    displayName: 'A',
    status: 'active',
    roles: ['admin'],
  },
  accountError: false,
  signIn: vi.fn(),
  signOut: vi.fn(),
  refetchAccount: vi.fn(),
};
function renderWith(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}
beforeEach(() => vi.clearAllMocks());

it('quota page warns when usage is high', async () => {
  vi.mocked(ops.getQuota).mockResolvedValue({
    db_bytes: 450 * 1024 * 1024,
    storage_bytes: 100 * 1024 * 1024,
    limits: {
      db_bytes: 500 * 1024 * 1024,
      storage_bytes: 1024 * 1024 * 1024,
      egress_bytes_month: 5 * 1024 ** 3,
      mau: 50000,
    },
    last_backup_at: null,
    users: 33,
    active_users_30d: 30,
    courses: 1,
    submissions: 10,
    quiz_attempts: 5,
    xp_transactions: 40,
    audit_logs: 3,
    largest_tables: [{ name: 'learning_events', bytes: 1024 }],
  });
  const { container } = renderWith(<QuotaPage />);
  expect(await screen.findByText(/ใกล้เต็ม/)).toBeInTheDocument();
  expect(screen.getByText(/ยังไม่เคย/)).toBeInTheDocument();
  expect((await axe(container)).violations).toEqual([]);
});

it('settings: unfinished features cannot be switched on; domains validated', async () => {
  vi.mocked(ops.listSettings).mockResolvedValue([
    { key: 'feature.leaderboard', value: false, description: null, updated_at: '' },
    { key: 'feature.ai_tutor', value: false, description: null, updated_at: '' },
    { key: 'auth.allowed_email_domains', value: [], description: null, updated_at: '' },
    { key: 'xp.lesson_complete', value: 10, description: null, updated_at: '' },
  ]);
  vi.mocked(ops.updateSetting).mockResolvedValue();
  const { container } = renderWith(<SettingsPage />);
  expect(await screen.findByRole('checkbox', { name: /AI Tutor/ })).toBeDisabled();
  await userEvent.click(screen.getByRole('checkbox', { name: /Leaderboard/ }));
  expect(ops.updateSetting).toHaveBeenCalledWith('feature.leaderboard', true, 'a1');
  await userEvent.type(screen.getByLabelText('โดเมนที่อนุญาต'), 'school.ac.th @bad');
  expect(screen.getByRole('alert')).toHaveTextContent('@bad');
  expect((await axe(container)).violations).toEqual([]);
});

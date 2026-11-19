import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import { LeaderboardCard } from './LeaderboardCard';
import * as api from './leaderboardApi';

vi.mock('./leaderboardApi', async (orig) => ({
  ...(await orig<typeof import('./leaderboardApi')>()),
  getLeaderboard: vi.fn(),
  getLeaderboardStatus: vi.fn(),
  getMyLeaderboardPrefs: vi.fn(),
  updateMyLeaderboardPrefs: vi.fn(),
}));

const auth: AuthState = {
  ready: true,
  configured: true,
  userId: 's1',
  account: {
    id: 's1',
    email: 's@school.test',
    displayName: 'S',
    status: 'active',
    roles: ['student'],
  },
  accountError: false,
  signIn: vi.fn(),
  signOut: vi.fn(),
  refetchAccount: vi.fn(),
};
function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={auth}>
        <h1>Course</h1>
        <LeaderboardCard courseId="c1" />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

it('renders nothing when disabled', async () => {
  vi.mocked(api.getLeaderboardStatus).mockResolvedValue({
    system_enabled: true,
    course_enabled: false,
  });
  renderCard();
  await new Promise((r) => setTimeout(r, 20));
  expect(screen.queryByText('Leaderboard')).not.toBeInTheDocument();
  expect(api.getLeaderboard).not.toHaveBeenCalled();
});

it('shows nicknames only and lets the student opt out', async () => {
  vi.mocked(api.getLeaderboardStatus).mockResolvedValue({
    system_enabled: true,
    course_enabled: true,
  });
  vi.mocked(api.getLeaderboard).mockResolvedValue([
    { rank: 1, nickname: 'Neo', level: 3, xp: 400, is_me: false },
    { rank: 2, nickname: 'Trinity', level: 2, xp: 150, is_me: true },
  ]);
  vi.mocked(api.getMyLeaderboardPrefs).mockResolvedValue({
    nickname: 'Trinity',
    leaderboard_opt_in: true,
  });
  vi.mocked(api.updateMyLeaderboardPrefs).mockResolvedValue();
  const { container } = renderCard();
  expect(await screen.findByText(/Trinity \(คุณ\)/)).toBeInTheDocument();
  await userEvent.click(await screen.findByLabelText('แสดงฉันใน Leaderboard'));
  await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
  expect(api.updateMyLeaderboardPrefs).toHaveBeenCalledWith('s1', false, 'Trinity');
  expect((await axe(container)).violations).toEqual([]);
});

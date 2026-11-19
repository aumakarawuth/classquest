import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import * as api from './api';
import UsersPage from './pages/UsersPage';
import AuditLogPage from './pages/AuditLogPage';

vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  listUsers: vi.fn(),
  setUserRole: vi.fn(),
  setUserStatus: vi.fn(),
  listAuditLogs: vi.fn(),
}));

const auth: AuthState = {
  ready: true,
  configured: true,
  userId: 'admin-1',
  account: {
    id: 'admin-1',
    email: 'a@school.test',
    displayName: 'Admin',
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

const pendingUser: api.AdminUser = {
  id: 'u-2',
  email: 'new@school.test',
  displayName: 'นักเรียนใหม่',
  status: 'pending',
  createdAt: '2026-11-19T03:00:00Z',
  roles: [],
};

beforeEach(() => vi.clearAllMocks());

it('approves a pending user with the chosen role', async () => {
  vi.mocked(api.listUsers).mockResolvedValue({ users: [pendingUser], total: 1 });
  vi.mocked(api.setUserRole).mockResolvedValue();
  vi.mocked(api.setUserStatus).mockResolvedValue();
  const { container } = renderWith(<UsersPage />);

  expect(await screen.findByText('นักเรียนใหม่')).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText('อนุมัติเป็น'), 'teacher');
  await userEvent.click(screen.getByRole('button', { name: 'อนุมัติ' }));

  expect(api.setUserRole).toHaveBeenCalledWith('u-2', 'teacher', true);
  expect(api.setUserStatus).toHaveBeenCalledWith('u-2', 'active');
  expect((await axe(container)).violations).toEqual([]);
});

it('requires confirmation before granting admin', async () => {
  vi.mocked(api.listUsers).mockResolvedValue({
    users: [{ ...pendingUser, status: 'active', roles: ['student'] }],
    total: 1,
  });
  vi.mocked(api.setUserRole).mockResolvedValue();
  renderWith(<UsersPage />);

  await userEvent.click(await screen.findByRole('button', { name: 'ผู้ดูแลระบบ' }));
  expect(api.setUserRole).not.toHaveBeenCalled();
  await userEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', { name: 'ยืนยัน' }),
  );
  expect(api.setUserRole).toHaveBeenCalledWith('u-2', 'admin', true);
});

it('admin cannot remove own admin role from the UI', async () => {
  vi.mocked(api.listUsers).mockResolvedValue({
    users: [
      { ...pendingUser, id: 'admin-1', displayName: 'Admin', status: 'active', roles: ['admin'] },
    ],
    total: 1,
  });
  renderWith(<UsersPage />);
  expect(await screen.findByRole('button', { name: 'ผู้ดูแลระบบ' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'ระงับบัญชี' })).not.toBeInTheDocument();
});

it('shows an error state with retry when loading fails', async () => {
  vi.mocked(api.listUsers).mockRejectedValue(new Error('boom'));
  renderWith(<UsersPage />);
  expect(await screen.findByRole('alert')).toBeInTheDocument();
});

it('renders audit entries in Thai', async () => {
  vi.mocked(api.listAuditLogs).mockResolvedValue({
    total: 1,
    entries: [
      {
        id: 'a1',
        actorName: 'Admin',
        action: 'user.role_granted',
        entity: 'user_roles',
        targetName: 'นักเรียนใหม่',
        before: null,
        after: { role: 'teacher' },
        createdAt: '2026-11-19T03:00:00Z',
      },
    ],
  });
  renderWith(<AuditLogPage />);
  expect(await screen.findByText('เพิ่มสิทธิ์', { exact: false })).toBeInTheDocument();
  expect(screen.getByText('ครูผู้สอน')).toBeInTheDocument();
});

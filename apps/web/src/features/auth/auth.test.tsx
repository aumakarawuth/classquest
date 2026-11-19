import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { ThemeProvider } from '@/lib/theme/ThemeProvider';
import type { Account } from './access';
import { AuthContext, type AuthState } from './AuthContext';
import { RequireArea, RootRedirect } from './guards';
import { describeAuthError } from './authErrors';
import { LoginPage } from './pages/LoginPage';

const account = (roles: Account['roles'], status: Account['status'] = 'active'): Account => ({
  id: 'u1',
  email: 'u1@school.test',
  displayName: 'U1',
  status,
  roles,
});

function makeAuth(partial: Partial<AuthState>): AuthState {
  return {
    ready: true,
    configured: true,
    userId: null,
    account: null,
    accountError: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    refetchAccount: vi.fn(),
    ...partial,
  };
}

function renderAt(path: string, auth: AuthState) {
  return render(
    <AuthContext.Provider value={auth}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/pending" element={<p>PENDING</p>} />
            <Route
              path="/student"
              element={
                <RequireArea area="student">
                  <p>STUDENT AREA</p>
                </RequireArea>
              }
            />
            <Route path="/teacher" element={<p>TEACHER AREA</p>} />
            <Route
              path="/admin"
              element={
                <RequireArea area="admin">
                  <p>ADMIN AREA</p>
                </RequireArea>
              }
            />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </AuthContext.Provider>,
  );
}

it('signed-out user is sent to login', () => {
  renderAt('/admin', makeAuth({}));
  expect(screen.getByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeInTheDocument();
});

it('pending account is sent to the pending page', () => {
  renderAt('/student', makeAuth({ userId: 'u1', account: account(['student'], 'pending') }));
  expect(screen.getByText('PENDING')).toBeInTheDocument();
});

it('student cannot open admin area', () => {
  renderAt('/admin', makeAuth({ userId: 'u1', account: account(['student']) }));
  expect(screen.getByText('คุณไม่มีสิทธิ์เข้าถึงหน้านี้')).toBeInTheDocument();
  expect(screen.queryByText('ADMIN AREA')).not.toBeInTheDocument();
});

it('root redirects to the highest role area', () => {
  renderAt('/', makeAuth({ userId: 'u1', account: account(['student', 'teacher']) }));
  expect(screen.getByText('TEACHER AREA')).toBeInTheDocument();
});

it('login button is disabled with an explanation when not configured', async () => {
  const { container } = renderAt('/login', makeAuth({ configured: false }));
  expect(screen.getByRole('button', { name: 'เข้าสู่ระบบด้วย Google' })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('ยังไม่ได้เชื่อมต่อฐานข้อมูล');
  expect((await axe(container)).violations).toEqual([]);
});

it('maps domain rejection to a Thai message', () => {
  expect(describeAuthError('Database error saving new user')).toContain('โดเมนของสถานศึกษา');
  expect(describeAuthError(null)).toBeNull();
});

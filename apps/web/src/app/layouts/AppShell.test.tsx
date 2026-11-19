import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import { ThemeProvider } from '@/lib/theme/ThemeProvider';
import { AppShell } from './AppShell';

function renderShell(signOut = vi.fn()) {
  const auth: AuthState = {
    ready: true,
    configured: true,
    userId: 't1',
    account: {
      id: 't1',
      email: 't@school.test',
      displayName: 'ครูทดสอบ',
      status: 'active',
      roles: ['teacher', 'admin'],
    },
    accountError: false,
    signIn: vi.fn(),
    signOut,
    refetchAccount: vi.fn(),
  };
  const router = createMemoryRouter(
    [
      {
        path: '/teacher',
        element: <AppShell area="teacher" />,
        children: [{ index: true, element: <h1>ภาพรวม</h1> }],
      },
    ],
    { initialEntries: ['/teacher'] },
  );
  return render(
    <AuthContext.Provider value={auth}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </AuthContext.Provider>,
  );
}

it('renders teacher navigation and passes axe', async () => {
  const { container } = renderShell();
  expect(screen.getByRole('navigation', { name: 'เมนูครูผู้สอน' })).toBeInTheDocument();
  expect(screen.getByText('ครูทดสอบ')).toBeInTheDocument();
  const switcher = screen.getByRole('navigation', { name: 'สลับบทบาท' });
  expect(switcher).toHaveTextContent('ครูผู้สอน');
  expect(switcher).toHaveTextContent('ผู้ดูแลระบบ');
  expect((await axe(container)).violations).toEqual([]);
});

it('signs out only after confirmation', async () => {
  const signOut = vi.fn();
  renderShell(signOut);
  await userEvent.click(screen.getByRole('button', { name: 'ออกจากระบบ' }));
  expect(signOut).not.toHaveBeenCalled();
  const dialog = screen.getByRole('alertdialog');
  await userEvent.click(within(dialog).getByRole('button', { name: 'ออกจากระบบ' }));
  expect(signOut).toHaveBeenCalledOnce();
});

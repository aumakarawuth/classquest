import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { ThemeProvider } from '@/lib/theme/ThemeProvider';
import { HomePage } from './HomePage';

const renderPage = () =>
  render(
    <ThemeProvider>
      <HomePage />
    </ThemeProvider>,
  );

it('renders the app title', () => {
  renderPage();
  expect(screen.getByRole('heading', { name: 'ClassQuest' })).toBeInTheDocument();
});

it('switches theme via the toggle', async () => {
  renderPage();
  await userEvent.click(screen.getByRole('radio', { name: 'โหมดมืด' }));
  expect(document.documentElement.dataset.theme).toBe('dark');
  await userEvent.click(screen.getByRole('radio', { name: 'โหมดสว่าง' }));
  expect(document.documentElement.dataset.theme).toBe('light');
});

it('has no detectable accessibility violations', async () => {
  const { container } = renderPage();
  const results = await axe(container);
  expect(results.violations).toEqual([]);
});

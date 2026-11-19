import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { Celebration } from './Celebration';

it('announces rewards, passes axe and closes', async () => {
  const onClose = vi.fn();
  render(<Celebration diff={{ xpGained: 150, levelUp: 3, newBadges: 1 }} onClose={onClose} />);
  const dialog = screen.getByRole('alertdialog', { name: 'เลเวลอัป! Lv 3' });
  expect(dialog).toHaveTextContent('+150 XP');
  expect(dialog).toHaveTextContent('Badge ใหม่ 1');
  expect((await axe(document.body)).violations).toEqual([]);
  await userEvent.click(screen.getByRole('button', { name: 'ลุยต่อ' }));
  expect(onClose).toHaveBeenCalled();
});

it('renders nothing without a diff', () => {
  render(<Celebration diff={null} onClose={vi.fn()} />);
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

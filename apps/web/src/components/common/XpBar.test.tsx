import { render, screen } from '@testing-library/react';
import { XpBar } from './XpBar';

it('exposes progress values to assistive tech', () => {
  render(<XpBar level={3} xpIntoLevel={120} xpForNextLevel={300} />);
  const bar = screen.getByRole('progressbar', { name: 'ความคืบหน้าสู่เลเวล 4' });
  expect(bar).toHaveAttribute('aria-valuenow', '120');
  expect(bar).toHaveAttribute('aria-valuemax', '300');
});

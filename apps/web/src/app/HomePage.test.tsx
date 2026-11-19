import { render, screen } from '@testing-library/react';
import { HomePage } from './HomePage';

it('renders the app title', () => {
  render(<HomePage />);
  expect(screen.getByRole('heading', { name: 'ClassQuest' })).toBeInTheDocument();
});

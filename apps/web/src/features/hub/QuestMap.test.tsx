import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { QuestMap } from './QuestMap';

it('renders accessible nodes with START marker and locked nodes not as links', async () => {
  const { container } = render(
    <MemoryRouter>
      <QuestMap
        sections={[
          {
            id: 'u1',
            title: 'สัปดาห์ 1',
            nodes: [
              { kind: 'lesson', id: 'l1', title: 'IoT', state: 'done', boss: false, href: '/a' },
              { kind: 'quest', id: 'q1', title: 'Mission 01', state: 'next', boss: false, href: '/b', xp: 100 },
              { kind: 'quest', id: 'q2', title: 'Boss', state: 'locked', boss: true, href: '/c', xp: 300 },
            ],
          },
        ]}
      />
    </MemoryRouter>,
  );
  expect(screen.getByText('START')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Mission 01 — ด่านถัดไป · 100 XP/ })).toHaveAttribute('href', '/b');
  expect(screen.queryByRole('link', { name: /Boss/ })).toBeNull();
  expect((await axe(container)).violations).toEqual([]);
});

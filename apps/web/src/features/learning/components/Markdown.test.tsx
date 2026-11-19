import { render, screen } from '@testing-library/react';
import { Markdown } from './Markdown';

it('does not render raw HTML or javascript links', () => {
  const { container } = render(
    <Markdown>
      {
        '<script>alert(1)</script><img src=x onerror=alert(1)>\n\n[bad](javascript:alert(1)) [ok](https://example.com)'
      }
    </Markdown>,
  );
  expect(container.querySelector('script')).toBeNull();
  expect(container.querySelector('img[onerror]')).toBeNull();
  expect(screen.getByText('bad').getAttribute('href') ?? '').toBe('');
  const ok = screen.getByRole('link', { name: 'ok' });
  expect(ok).toHaveAttribute('href', 'https://example.com');
  expect(ok).toHaveAttribute('rel', 'noopener noreferrer');
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';

it('EmptyState shows title and description', () => {
  render(<EmptyState title="ยังไม่มีภารกิจ" description="ครูยังไม่ได้เผยแพร่ภารกิจ" />);
  expect(screen.getByRole('heading', { name: 'ยังไม่มีภารกิจ' })).toBeInTheDocument();
});

it('ErrorState calls onRetry', async () => {
  const onRetry = vi.fn();
  render(<ErrorState onRetry={onRetry} />);
  expect(screen.getByRole('alert')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'ลองใหม่' }));
  expect(onRetry).toHaveBeenCalledOnce();
});

it('ConfirmDialog only confirms after explicit confirmation', async () => {
  const onConfirm = vi.fn();
  render(
    <ConfirmDialog
      trigger={<Button>ลบ</Button>}
      title="ยืนยันการลบ"
      description="การลบไม่สามารถย้อนกลับได้"
      destructive
      onConfirm={onConfirm}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'ลบ' }));
  await userEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }));
  expect(onConfirm).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'ลบ' }));
  await userEvent.click(screen.getByRole('button', { name: 'ยืนยัน' }));
  expect(onConfirm).toHaveBeenCalledOnce();
});

import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { buttonVariants } from '@/components/ui/button';

export function ForbiddenPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="sr-only">ไม่มีสิทธิ์เข้าถึง</h1>
      <EmptyState
        icon={ShieldAlert}
        title="คุณไม่มีสิทธิ์เข้าถึงหน้านี้"
        description="หากคิดว่าเป็นความผิดพลาด กรุณาติดต่อผู้ดูแลระบบ"
        action={
          <Link to="/" className={buttonVariants({ variant: 'outline' })}>
            กลับหน้าหลักของฉัน
          </Link>
        }
      />
    </main>
  );
}

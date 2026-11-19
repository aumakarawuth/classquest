import { Clock, LogOut, RotateCw, ShieldOff } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Button } from '@/components/ui/button';
import { defaultArea } from '../access';
import { useAuth } from '../useAuth';
import { AuthLayout } from './AuthLayout';

export function PendingPage() {
  const auth = useAuth();
  if (!auth.ready) return <PageSkeleton />;
  if (!auth.userId) return <Navigate to="/login" replace />;
  if (auth.account && defaultArea(auth.account)) return <Navigate to="/" replace />;

  const suspended = auth.account?.status === 'suspended';
  const Icon = suspended ? ShieldOff : Clock;

  return (
    <AuthLayout>
      <div className="space-y-3 text-center">
        <span className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-muted">
          <Icon className="size-6 text-muted-foreground" aria-hidden />
        </span>
        <h1 className="text-xl font-bold">{suspended ? 'บัญชีถูกระงับการใช้งาน' : 'รอการอนุมัติบัญชี'}</h1>
        <p className="text-sm text-muted-foreground">
          {suspended
            ? 'กรุณาติดต่อผู้ดูแลระบบหรือครูผู้สอน'
            : 'ผู้ดูแลระบบจะตรวจสอบและกำหนดสิทธิ์ให้บัญชีของคุณ เมื่ออนุมัติแล้วกด "ตรวจสอบอีกครั้ง"'}
        </p>
        {auth.account && <p className="text-sm font-medium">{auth.account.email}</p>}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        {!suspended && (
          <Button className="flex-1" onClick={auth.refetchAccount}>
            <RotateCw aria-hidden />
            ตรวจสอบอีกครั้ง
          </Button>
        )}
        <Button className="flex-1" variant="outline" onClick={() => void auth.signOut()}>
          <LogOut aria-hidden />
          ออกจากระบบ
        </Button>
      </div>
    </AuthLayout>
  );
}

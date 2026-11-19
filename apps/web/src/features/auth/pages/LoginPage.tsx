import { AlertTriangle, LogIn } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '../useAuth';
import { describeAuthError } from '../authErrors';
import { AuthLayout } from './AuthLayout';

export function LoginPage() {
  const auth = useAuth();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const params = new URLSearchParams(location.search || location.hash.replace(/^#/, '?'));
  const callbackError = describeAuthError(params.get('error_description') ?? params.get('error'));

  if (auth.ready && auth.userId) return <Navigate to="/" replace />;

  const onSignIn = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await auth.signIn(); // browser navigates to Google on success
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  const message = failed ? 'ไม่สามารถเชื่อมต่อระบบเข้าสู่ระบบได้ กรุณาลองใหม่' : callbackError;

  return (
    <AuthLayout>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">เข้าสู่ระบบ</h1>
        <p className="text-sm text-muted-foreground">ใช้บัญชี Google ของสถานศึกษา</p>
      </div>

      {message && (
        <p
          role="alert"
          className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          {message}
        </p>
      )}

      {!auth.configured && (
        <p role="status" className="rounded-lg border bg-muted p-3 text-sm text-muted-foreground">
          ระบบยังไม่ได้เชื่อมต่อฐานข้อมูล (ยังไม่ได้ตั้งค่า VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY)
          จึงยังเข้าสู่ระบบไม่ได้
        </p>
      )}

      <Button className="w-full" onClick={onSignIn} disabled={!auth.configured || busy}>
        <LogIn aria-hidden />
        {busy ? 'กำลังไปยัง Google…' : 'เข้าสู่ระบบด้วย Google'}
      </Button>

      <p className="text-xs text-muted-foreground">
        บัญชีใหม่ต้องได้รับการอนุมัติจากผู้ดูแลระบบก่อนใช้งาน ระบบเก็บข้อมูลเท่าที่จำเป็นต่อการเรียนการสอน
      </p>
    </AuthLayout>
  );
}

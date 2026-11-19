import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import type { ShellArea } from '@/app/navigation';
import { canAccessArea, defaultArea } from './access';
import { useAuth } from './useAuth';
import { ForbiddenPage } from './pages/ForbiddenPage';

function FullPageLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageSkeleton />
    </div>
  );
}

/** Requires a signed-in, active account allowed into `area`. UI guard only — RLS enforces data access. */
export function RequireArea({ area, children }: { area: ShellArea; children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();

  if (!auth.ready) return <FullPageLoading />;
  if (!auth.userId) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (auth.accountError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <ErrorState onRetry={auth.refetchAccount} />
      </div>
    );
  }
  if (!auth.account || auth.account.status !== 'active' || !defaultArea(auth.account)) {
    return <Navigate to="/pending" replace />;
  }
  if (!canAccessArea(auth.account, area)) return <ForbiddenPage />;
  return children;
}

/** `/` → the user's landing area (or login / pending). */
export function RootRedirect() {
  const auth = useAuth();
  if (!auth.ready) return <FullPageLoading />;
  if (!auth.userId) return <Navigate to="/login" replace />;
  const area = auth.account ? defaultArea(auth.account) : null;
  return <Navigate to={area ? `/${area}` : '/pending'} replace />;
}

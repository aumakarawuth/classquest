import { Navigate, useLocation } from 'react-router-dom';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { useAuth } from '../useAuth';

/** Supabase exchanges the OAuth code automatically (detectSessionInUrl); we wait, then route. */
export function AuthCallbackPage() {
  const auth = useAuth();
  const location = useLocation();
  const hasError = /error/.test(location.search + location.hash);

  if (hasError) return <Navigate to={`/login${location.search}${location.hash}`} replace />;
  if (auth.ready && auth.userId) return <Navigate to="/" replace />;
  if (auth.ready && !auth.userId && !/code=/.test(location.search))
    return <Navigate to="/login" replace />;
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <PageSkeleton />
    </div>
  );
}

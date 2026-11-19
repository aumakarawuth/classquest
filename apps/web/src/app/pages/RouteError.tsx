import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { ErrorState } from '@/components/common/ErrorState';
import { NotFoundPage } from '../NotFoundPage';

export function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <ErrorState
        description="หน้านี้ทำงานผิดพลาด กรุณาโหลดหน้าใหม่"
        onRetry={() => window.location.reload()}
      />
    </div>
  );
}

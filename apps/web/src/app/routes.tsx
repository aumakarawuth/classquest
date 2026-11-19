/* eslint-disable react-refresh/only-export-components -- route config module, not a component */
import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { ComingSoon } from '@/components/common/ComingSoon';
import { RequireArea, RootRedirect } from '@/features/auth/guards';
import { AuthCallbackPage } from '@/features/auth/pages/AuthCallbackPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { PendingPage } from '@/features/auth/pages/PendingPage';
import { AppShell } from './layouts/AppShell';
import { navAreas, type ShellArea } from './navigation';
import { NotFoundPage } from './NotFoundPage';
import { RouteError } from './pages/RouteError';

const StudentDashboard = lazy(() => import('./pages/StudentDashboard'));

/** Phase in which each area's pages are delivered (shown on placeholders). */
const plannedPhase: Record<ShellArea, string> = {
  student: 'Phase 2–6',
  teacher: 'Phase 2–6',
  admin: 'Phase 1 (P1-08) และ Phase 6',
};

function areaRoutes(area: ShellArea): RouteObject {
  const nav = navAreas[area];
  return {
    path: nav.basePath,
    element: (
      <RequireArea area={area}>
        <AppShell area={area} />
      </RequireArea>
    ),
    children: nav.items.map((item) => {
      const element =
        area === 'student' && item.path === '' ? (
          <StudentDashboard />
        ) : (
          <ComingSoon title={item.label} phase={plannedPhase[area]} />
        );
      return item.path === '' ? { index: true, element } : { path: item.path, element };
    }),
  };
}

export const routes: RouteObject[] = [
  {
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <RootRedirect /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/auth/callback', element: <AuthCallbackPage /> },
      { path: '/pending', element: <PendingPage /> },
      areaRoutes('student'),
      areaRoutes('teacher'),
      areaRoutes('admin'),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

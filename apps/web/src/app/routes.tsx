/* eslint-disable react-refresh/only-export-components -- route config module, not a component */
import { lazy, type ReactElement } from 'react';
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
const UsersPage = lazy(() => import('@/features/admin/pages/UsersPage'));
const RolesPage = lazy(() => import('@/features/admin/pages/RolesPage'));
const AuditLogPage = lazy(() => import('@/features/admin/pages/AuditLogPage'));
const TeacherCoursesPage = lazy(() => import('@/features/courses/pages/TeacherCoursesPage'));
const CourseFormPage = lazy(() => import('@/features/courses/pages/CourseFormPage'));
const TeacherCourseDetailPage = lazy(
  () => import('@/features/courses/pages/TeacherCourseDetailPage'),
);
const StudentCoursesPage = lazy(() => import('@/features/courses/pages/StudentCoursesPage'));
const CourseBuilderPage = lazy(() => import('@/features/learning/pages/CourseBuilderPage'));
const LessonEditorPage = lazy(() => import('@/features/learning/pages/LessonEditorPage'));
const StudentCoursePage = lazy(() => import('@/features/learning/pages/StudentCoursePage'));
const LessonViewerPage = lazy(() => import('@/features/learning/pages/LessonViewerPage'));
const TeacherQuestsPage = lazy(() => import('@/features/quests/pages/TeacherQuestsPage'));
const QuestEditorPage = lazy(() => import('@/features/quests/pages/QuestEditorPage'));
const QuestBoardPage = lazy(() => import('@/features/quests/pages/QuestBoardPage'));
const QuestDetailPage = lazy(() => import('@/features/quests/pages/QuestDetailPage'));
const ReviewQueuePage = lazy(() => import('@/features/quests/pages/ReviewQueuePage'));
const ReviewDetailPage = lazy(() => import('@/features/quests/pages/ReviewDetailPage'));

/** Detail routes that are not menu items. */
const extraRoutes: Partial<Record<ShellArea, RouteObject[]>> = {
  teacher: [
    { path: 'courses/new', element: <CourseFormPage /> },
    { path: 'courses/:courseId', element: <TeacherCourseDetailPage /> },
    { path: 'courses/:courseId/builder', element: <CourseBuilderPage /> },
    { path: 'courses/:courseId/lessons/:lessonId', element: <LessonEditorPage /> },
    { path: 'courses/:courseId/quests', element: <TeacherQuestsPage /> },
    { path: 'courses/:courseId/quests/:questId', element: <QuestEditorPage /> },
    { path: 'reviews/:submissionId', element: <ReviewDetailPage /> },
  ],
  student: [
    { path: 'courses/:courseId', element: <StudentCoursePage /> },
    { path: 'courses/:courseId/lessons/:lessonId', element: <LessonViewerPage /> },
    { path: 'quests/:questId', element: <QuestDetailPage /> },
  ],
};

/** Pages that are implemented; everything else renders an honest ComingSoon. */
const implemented: Partial<Record<ShellArea, Record<string, ReactElement>>> = {
  student: {
    '': <StudentDashboard />,
    courses: <StudentCoursesPage />,
    quests: <QuestBoardPage />,
  },
  teacher: { courses: <TeacherCoursesPage />, reviews: <ReviewQueuePage /> },
  admin: { users: <UsersPage />, roles: <RolesPage />, audit: <AuditLogPage /> },
};

/** Phase in which each area's pages are delivered (shown on placeholders). */
const plannedPhase: Record<ShellArea, string> = {
  student: 'Phase 2–6',
  teacher: 'Phase 2–6',
  admin: 'Phase 6',
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
    children: [
      ...nav.items.map((item): RouteObject => {
        const element = implemented[area]?.[item.path] ?? (
          <ComingSoon title={item.label} phase={plannedPhase[area]} />
        );
        return item.path === '' ? { index: true, element } : { path: item.path, element };
      }),
      ...(extraRoutes[area] ?? []),
    ],
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

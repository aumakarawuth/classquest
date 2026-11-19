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
const CourseLevelsPage = lazy(() => import('@/features/gamification/pages/CourseLevelsPage'));
const CourseBadgesPage = lazy(() => import('@/features/gamification/pages/CourseBadgesPage'));
const AchievementsPage = lazy(() => import('@/features/gamification/pages/AchievementsPage'));
const CompetencyManagePage = lazy(() => import('@/features/competency/pages/CompetencyManagePage'));
const CompetencyMatrixPage = lazy(() => import('@/features/competency/pages/CompetencyMatrixPage'));
const StudentReportPage = lazy(() => import('@/features/competency/pages/StudentReportPage'));
const MyCompetencyPage = lazy(() => import('@/features/competency/pages/MyCompetencyPage'));
const TeacherCompetencyIndexPage = lazy(
  () => import('@/features/competency/pages/TeacherCompetencyIndexPage'),
);

const QuizListPage = lazy(() => import('@/features/assessment/pages/QuizListPage'));
const QuizEditorPage = lazy(() => import('@/features/assessment/pages/QuizEditorPage'));
const QuestionBankPage = lazy(() => import('@/features/assessment/pages/QuestionBankPage'));
const QuizResultsPage = lazy(() => import('@/features/assessment/pages/QuizResultsPage'));
const QuizIntroPage = lazy(() => import('@/features/assessment/pages/QuizIntroPage'));
const TakeQuizPage = lazy(() => import('@/features/assessment/pages/TakeQuizPage'));
const AttemptResultPage = lazy(() => import('@/features/assessment/pages/AttemptResultPage'));
const PrePostReportPage = lazy(() => import('@/features/assessment/pages/PrePostReportPage'));

const ClassroomPage = lazy(() => import('@/features/classroom/pages/ClassroomPage'));

const TeacherLabsPage = lazy(() => import('@/features/labs/pages/TeacherLabsPage'));
const StudentLabsPage = lazy(() => import('@/features/labs/pages/StudentLabsPage'));
const LabDetailPage = lazy(() => import('@/features/labs/pages/LabDetailPage'));

const TeacherDashboardPage = lazy(() => import('@/features/analytics/pages/TeacherDashboardPage'));

const MyPortfolioPage = lazy(() => import('@/features/portfolio/pages/MyPortfolioPage'));
const TeacherPortfolioPage = lazy(() => import('@/features/portfolio/pages/TeacherPortfolioPage'));

const EvidenceCenterPage = lazy(() => import('@/features/evidence/pages/EvidenceCenterPage'));
const EvidenceReportPage = lazy(() => import('@/features/evidence/pages/EvidenceReportPage'));
const SurveyPage = lazy(() => import('@/features/evidence/pages/SurveyPage'));

const AdminOverviewPage = lazy(() => import('@/features/admin/pages/AdminOverviewPage'));
const QuotaPage = lazy(() => import('@/features/admin/pages/QuotaPage'));
const BackupPage = lazy(() => import('@/features/admin/pages/BackupPage'));
const SystemSettingsPage = lazy(() => import('@/features/admin/pages/SettingsPage'));

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
    { path: 'courses/:courseId/levels', element: <CourseLevelsPage /> },
    { path: 'courses/:courseId/badges', element: <CourseBadgesPage /> },
    { path: 'courses/:courseId/competencies', element: <CompetencyManagePage /> },
    { path: 'courses/:courseId/competency-matrix', element: <CompetencyMatrixPage /> },
    { path: 'courses/:courseId/competency/:userId', element: <StudentReportPage /> },
    { path: 'courses/:courseId/quizzes', element: <QuizListPage /> },
    { path: 'courses/:courseId/quizzes/:quizId', element: <QuizEditorPage /> },
    { path: 'courses/:courseId/question-bank', element: <QuestionBankPage /> },
    { path: 'courses/:courseId/quizzes/:quizId/results', element: <QuizResultsPage /> },
    { path: 'courses/:courseId/prepost', element: <PrePostReportPage /> },
    { path: 'courses/:courseId/labs', element: <TeacherLabsPage /> },
    { path: 'courses/:courseId/portfolio/:userId', element: <TeacherPortfolioPage /> },
    { path: 'courses/:courseId/evidence/report', element: <EvidenceReportPage /> },
  ],
  student: [
    { path: 'courses/:courseId', element: <StudentCoursePage /> },
    { path: 'courses/:courseId/lessons/:lessonId', element: <LessonViewerPage /> },
    { path: 'quests/:questId', element: <QuestDetailPage /> },
    { path: 'quizzes/:quizId', element: <QuizIntroPage /> },
    { path: 'labs/:labId', element: <LabDetailPage /> },
    { path: 'surveys/:surveyId', element: <SurveyPage /> },
    { path: 'attempts/:attemptId', element: <TakeQuizPage /> },
    { path: 'attempts/:attemptId/result', element: <AttemptResultPage /> },
  ],
};

/** Pages that are implemented; everything else renders an honest ComingSoon. */
const implemented: Partial<Record<ShellArea, Record<string, ReactElement>>> = {
  student: {
    '': <StudentDashboard />,
    courses: <StudentCoursesPage />,
    quests: <QuestBoardPage />,
    achievements: <AchievementsPage />,
    competency: <MyCompetencyPage />,
    labs: <StudentLabsPage />,
    portfolio: <MyPortfolioPage />,
  },
  teacher: {
    '': <TeacherDashboardPage />,
    analytics: <TeacherDashboardPage />,
    courses: <TeacherCoursesPage />,
    reviews: <ReviewQueuePage />,
    competency: <TeacherCompetencyIndexPage />,
    classroom: <ClassroomPage />,
    evidence: <EvidenceCenterPage />,
  },
  admin: {
    '': <AdminOverviewPage />,
    users: <UsersPage />,
    roles: <RolesPage />,
    audit: <AuditLogPage />,
    quota: <QuotaPage />,
    backup: <BackupPage />,
    settings: <SystemSettingsPage />,
  },
};

/** Phase in which each area's pages are delivered (shown on placeholders). */
const plannedPhase: Record<ShellArea, string> = {
  student: 'Phase 2–6',
  teacher: 'Phase 2–6',
  admin: 'ระยะถัดไป',
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

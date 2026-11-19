import { useQuery } from '@tanstack/react-query';
import { BookOpen, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { buttonVariants } from '@/components/ui/button';
import { useAuth } from '@/features/auth/useAuth';
import { listMyCourses } from '../api';
import { CourseCard } from '../CourseCard';

export default function TeacherCoursesPage() {
  const { userId } = useAuth();
  const query = useQuery({
    queryKey: ['courses', 'teacher', userId],
    queryFn: () => listMyCourses(userId ?? '', 'teacher'),
    enabled: !!userId,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">จัดการรายวิชา</h1>
          <p className="text-sm text-muted-foreground">รายวิชาที่คุณสอน</p>
        </div>
        <Link to="/teacher/courses/new" className={buttonVariants()}>
          <Plus aria-hidden />
          สร้างรายวิชา
        </Link>
      </div>
      {query.isPending ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="ยังไม่มีรายวิชา"
          description="สร้างรายวิชาแรก ระบบจะเตรียมหน่วยการเรียนรู้รายสัปดาห์ให้อัตโนมัติ"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {query.data.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              to={`/teacher/courses/${course.id}`}
              showStatus
            />
          ))}
        </div>
      )}
    </div>
  );
}

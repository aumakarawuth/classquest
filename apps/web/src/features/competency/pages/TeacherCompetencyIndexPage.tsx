import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/features/auth/useAuth';
import { listMyCourses } from '@/features/courses/api';

export default function TeacherCompetencyIndexPage() {
  const { userId } = useAuth();
  const courses = useQuery({
    queryKey: ['courses', 'teacher', userId],
    queryFn: () => listMyCourses(userId ?? '', 'teacher'),
    enabled: !!userId,
  });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">สมรรถนะ</h1>
      {courses.isPending ? (
        <PageSkeleton />
      ) : courses.isError ? (
        <ErrorState onRetry={() => void courses.refetch()} />
      ) : courses.data.length === 0 ? (
        <EmptyState title="ยังไม่มีรายวิชา" />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {courses.data.map((c) => (
            <li key={c.id}>
              <Card className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">{c.code}</p>
                  <h2 className="font-semibold">{c.name}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/teacher/courses/${c.id}/competencies`}
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  >
                    จัดการสมรรถนะ
                  </Link>
                  <Link
                    to={`/teacher/courses/${c.id}/competency-matrix`}
                    className={buttonVariants({ size: 'sm' })}
                  >
                    ตารางสมรรถนะ
                  </Link>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

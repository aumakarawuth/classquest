import { useQuery } from '@tanstack/react-query';
import { Target } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { useAuth } from '@/features/auth/useAuth';
import { listMyCourses } from '@/features/courses/api';
import { CompetencyReport } from '../components/CompetencyReport';

export default function MyCompetencyPage() {
  const { userId } = useAuth();
  const courses = useQuery({
    queryKey: ['courses', 'student', userId],
    queryFn: () => listMyCourses(userId ?? '', 'student'),
    enabled: !!userId,
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">สมรรถนะของฉัน</h1>
        <p className="text-sm text-muted-foreground">
          ผลการประเมินจากหลักฐานจริง: ภารกิจ Rubric และการประเมินของครู
        </p>
      </div>
      {courses.isPending ? (
        <PageSkeleton />
      ) : courses.isError ? (
        <ErrorState onRetry={() => void courses.refetch()} />
      ) : courses.data.length === 0 ? (
        <EmptyState icon={Target} title="ยังไม่ได้เข้าร่วมรายวิชา" />
      ) : (
        courses.data.map((c) => (
          <section key={c.id} aria-labelledby={`mc-${c.id}`} className="space-y-3">
            <h2 id={`mc-${c.id}`} className="font-semibold">
              {c.code} {c.name}
            </h2>
            <CompetencyReport courseId={c.id} userId={userId ?? ''} />
          </section>
        ))
      )}
    </div>
  );
}

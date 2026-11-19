import { useQuery } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/features/auth/useAuth';
import { listMyCourses } from '@/features/courses/api';
import { listLabs } from '../api';

export default function StudentLabsPage() {
  const { userId } = useAuth();
  const query = useQuery({
    queryKey: ['labs', 'student', userId],
    enabled: !!userId,
    queryFn: async () => {
      const courses = await listMyCourses(userId ?? '', 'student');
      return { courses, labs: await listLabs(courses.map((c) => c.id)) };
    },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Virtual Lab</h1>
        <p className="text-sm text-muted-foreground">
          ทดลองต่อวงจรและเขียนโปรแกรมบน Wokwi ผ่านเบราว์เซอร์
        </p>
      </div>
      {query.isPending ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.data.labs.length === 0 ? (
        <EmptyState icon={FlaskConical} title="ยังไม่มีการทดลอง" />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {query.data.labs.map((l) => (
            <li key={l.id}>
              <Link to={`/student/labs/${l.id}`} className="block h-full rounded-lg">
                <Card className="h-full space-y-2 hover:border-primary/50">
                  <span className="inline-flex size-10 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
                    <FlaskConical className="size-5" aria-hidden />
                  </span>
                  <h2 className="font-semibold">{l.title}</h2>
                  <p className="text-xs text-muted-foreground">
                    {query.data.courses.find((c) => c.id === l.course_id)?.code}
                    {l.components.length > 0 && ` · ${l.components.join(', ')}`}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

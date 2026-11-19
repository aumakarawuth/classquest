import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Lock } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Button } from '@/components/ui/button';
import { getCourse } from '@/features/courses/api';
import { supabase } from '@/lib/supabase';
import { PortfolioView } from '../components/PortfolioView';

async function getShared(courseId: string, userId: string) {
  if (!supabase) throw new Error('Supabase is not configured');
  const [pf, prof] = await Promise.all([
    supabase
      .from('portfolios')
      .select('visibility')
      .eq('course_id', courseId)
      .eq('user_id', userId)
      .maybeSingle(),
    supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle(),
  ]);
  if (pf.error) throw pf.error;
  return {
    shared: (pf.data as { visibility?: string } | null)?.visibility === 'teacher',
    name: (prof.data as { display_name?: string } | null)?.display_name ?? '',
  };
}

export default function TeacherPortfolioPage() {
  const { courseId = '', userId = '' } = useParams();
  const course = useQuery({
    queryKey: ['courses', 'detail', courseId],
    queryFn: () => getCourse(courseId),
  });
  const shared = useQuery({
    queryKey: ['portfolio-shared', courseId, userId],
    queryFn: () => getShared(courseId, userId),
  });
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex justify-between gap-2 print:hidden">
        <Link
          to="/teacher"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          ภาพรวม
        </Link>
        {shared.data?.shared && (
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            พิมพ์ / บันทึก PDF
          </Button>
        )}
      </div>
      {shared.isPending || course.isPending ? (
        <PageSkeleton />
      ) : !shared.data?.shared ? (
        <EmptyState
          icon={Lock}
          title="นักเรียนยังไม่ได้แชร์แฟ้มสะสมผลงาน"
          description="แฟ้มเป็นส่วนตัวโดยค่าเริ่มต้น นักเรียนเลือกแชร์ให้ครูผู้สอนได้ในหน้าแฟ้มของตนเอง"
        />
      ) : (
        <PortfolioView
          courseId={courseId}
          userId={userId}
          editable={false}
          courseTitle={course.data ? `${course.data.code} ${course.data.name}` : ''}
          studentName={shared.data.name}
        />
      )}
    </div>
  );
}

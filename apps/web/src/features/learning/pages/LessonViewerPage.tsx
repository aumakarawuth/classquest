import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CheckCircle2, Lock } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getLesson } from '../api';
import { Markdown } from '../components/Markdown';
import { ResourceView } from '../components/ResourceView';
import { questStageLabels } from '../resources';
import { completeLesson, studentLearningError } from '../studentApi';
import { useRoadmap } from '../useRoadmap';

export default function LessonViewerPage() {
  const { courseId = '', lessonId = '' } = useParams();
  const queryClient = useQueryClient();
  const lesson = useQuery({ queryKey: ['lesson', lessonId], queryFn: () => getLesson(lessonId) });
  const roadmap = useRoadmap(courseId);

  const complete = useMutation({
    mutationFn: () => completeLesson(lessonId),
    onSuccess: () => {
      toast.success('บันทึกว่าเรียนจบแล้ว');
      void queryClient.invalidateQueries({ queryKey: ['roadmap', courseId] });
    },
    onError: (e) => toast.error(studentLearningError(e)),
  });

  const back = (
    <Link
      to={`/student/courses/${courseId}`}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden />
      เส้นทางการเรียน
    </Link>
  );

  if (lesson.isPending || roadmap.isPending) return <PageSkeleton />;
  if (lesson.isError || roadmap.isError) {
    return <ErrorState onRetry={() => void Promise.all([lesson.refetch(), roadmap.refetch()])} />;
  }
  const seq = roadmap.data.sequence;
  const index = seq.findIndex((l) => l.id === lessonId);
  const current = seq[index];
  if (!lesson.data || !current) {
    return (
      <div className="space-y-6">
        {back}
        <EmptyState title="ไม่พบบทเรียน" description="บทเรียนนี้อาจยังไม่เผยแพร่" />
      </div>
    );
  }
  if (current.state === 'locked') {
    return (
      <div className="space-y-6">
        {back}
        <EmptyState
          icon={Lock}
          title="บทเรียนนี้ยังล็อกอยู่"
          description={current.lockedBy ? `เรียน “${current.lockedBy}” ให้จบก่อน` : undefined}
        />
      </div>
    );
  }

  const prev = index > 0 ? seq[index - 1] : undefined;
  const next = seq[index + 1];
  const done = current.state === 'completed';

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      {back}
      <header className="space-y-1">
        {lesson.data.quest_stage && (
          <p className="text-sm font-medium text-primary">
            {questStageLabels[lesson.data.quest_stage]}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tight">{lesson.data.title}</h1>
        {lesson.data.estimated_minutes && (
          <p className="text-sm text-muted-foreground">
            ใช้เวลาประมาณ {lesson.data.estimated_minutes} นาที
          </p>
        )}
      </header>

      {lesson.data.body_md.trim() && (
        <Card>
          <Markdown>{lesson.data.body_md}</Markdown>
        </Card>
      )}
      {lesson.data.lesson_resources.length > 0 && (
        <section aria-labelledby="resources-heading" className="space-y-3">
          <h2 id="resources-heading" className="font-semibold">
            สื่อการเรียนรู้
          </h2>
          {lesson.data.lesson_resources.map((r) => (
            <ResourceView key={r.id} resource={r} />
          ))}
        </section>
      )}

      <Card className="flex flex-col items-center gap-3 text-center">
        {done ? (
          <p className="inline-flex items-center gap-2 font-medium text-success">
            <CheckCircle2 className="size-5" aria-hidden />
            คุณเรียนบทนี้จบแล้ว
          </p>
        ) : (
          <Button onClick={() => complete.mutate()} disabled={complete.isPending}>
            <CheckCircle2 aria-hidden />
            {complete.isPending ? 'กำลังบันทึก…' : 'ทำเครื่องหมายว่าเรียนจบ'}
          </Button>
        )}
      </Card>

      <nav aria-label="บทเรียนก่อนหน้าและถัดไป" className="flex justify-between gap-2">
        {prev ? (
          <Link
            to={`/student/courses/${courseId}/lessons/${prev.id}`}
            className={buttonVariants({ variant: 'outline' })}
          >
            <ArrowLeft aria-hidden />
            <span className="max-w-32 truncate sm:max-w-60">{prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link
            to={`/student/courses/${courseId}/lessons/${next.id}`}
            className={buttonVariants({
              variant: next.state === 'locked' && !done ? 'outline' : 'default',
            })}
          >
            <span className="max-w-32 truncate sm:max-w-60">{next.title}</span>
            <ArrowRight aria-hidden />
          </Link>
        )}
      </nav>
    </article>
  );
}

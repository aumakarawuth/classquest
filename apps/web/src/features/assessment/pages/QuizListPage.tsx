import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ClipboardList, Plus } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { listQuizzes, quizKindLabels } from '../api';

export default function QuizListPage() {
  const { courseId = '' } = useParams();
  const query = useQuery({ queryKey: ['quizzes', courseId], queryFn: () => listQuizzes(courseId) });
  return (
    <div className="space-y-6">
      <Link
        to={`/teacher/courses/${courseId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        กลับไปที่รายวิชา
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">แบบทดสอบ</h1>
        <div className="flex gap-2">
          <Link
            to={`/teacher/courses/${courseId}/question-bank`}
            className={buttonVariants({ variant: 'outline' })}
          >
            คลังข้อสอบ
          </Link>
          <Link to={`/teacher/courses/${courseId}/quizzes/new`} className={buttonVariants()}>
            <Plus aria-hidden />
            สร้างแบบทดสอบ
          </Link>
        </div>
      </div>
      {query.isPending ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="ยังไม่มีแบบทดสอบ"
          description="เริ่มจากสร้างคำถามในคลังข้อสอบ แล้วสร้าง Pre-test และ Post-test"
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {query.data.map((q) => (
            <li key={q.id}>
              <Link
                to={`/teacher/courses/${courseId}/quizzes/${q.id}`}
                className="block rounded-lg"
              >
                <Card className="space-y-1 hover:border-primary/50">
                  <p className="text-xs text-muted-foreground">
                    {quizKindLabels[q.kind]} · {q.published ? 'เผยแพร่' : 'ฉบับร่าง'}
                  </p>
                  <h2 className="font-semibold">{q.title}</h2>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

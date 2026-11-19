import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { inputClass } from '@/components/ui/field-utils';
import { formatThaiDateTime } from '@/lib/datetime';
import {
  attemptErrorMessage,
  getAttemptResult,
  gradeAnswer,
  listQuizAttempts,
} from '../attemptApi';

export default function QuizResultsPage() {
  const { courseId = '', quizId = '' } = useParams();
  const query = useQuery({
    queryKey: ['quiz-results', quizId],
    queryFn: () => listQuizAttempts(quizId),
  });
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-6">
      <Link
        to={`/teacher/courses/${courseId}/quizzes/${quizId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        แบบทดสอบ
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">ผลการทำแบบทดสอบ</h1>
      {query.isPending ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <EmptyState title="ยังไม่มีนักเรียนส่งคำตอบ" />
      ) : (
        <ul className="space-y-2">
          {query.data.map((a) => (
            <li key={a.id}>
              <Card className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium">
                    {a.profiles.display_name} · ครั้งที่ {a.attempt_no}
                  </span>
                  <span>
                    {a.status === 'graded' ? (
                      `${a.score}/${a.max_score}`
                    ) : (
                      <strong>รอตรวจข้อเขียน</strong>
                    )}
                  </span>
                  {a.submitted_at && (
                    <time dateTime={a.submitted_at} className="text-xs text-muted-foreground">
                      {formatThaiDateTime(a.submitted_at)}
                    </time>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    aria-expanded={open === a.id}
                    onClick={() => setOpen(open === a.id ? null : a.id)}
                  >
                    {open === a.id ? 'ซ่อน' : 'ดู/ตรวจ'}
                  </Button>
                </div>
                {open === a.id && <AttemptDetail attemptId={a.id} quizId={quizId} />}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AttemptDetail({ attemptId, quizId }: { attemptId: string; quizId: string }) {
  const query = useQuery({
    queryKey: ['attempt-result', attemptId],
    queryFn: () => getAttemptResult(attemptId),
  });
  if (query.isPending) return <p className="text-sm text-muted-foreground">กำลังโหลด…</p>;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  return (
    <ol className="space-y-2 text-sm">
      {query.data.questions.map((q, i) => (
        <li key={q.id} className="rounded-lg border p-3">
          <p className="font-medium">
            {i + 1}. {q.stem}
          </p>
          <p>
            คำตอบ:{' '}
            {q.type === 'short'
              ? q.my_text || '—'
              : (q.options.find((o) => o.id === q.my_option_id)?.label ?? '—')}
            {' · '}
            {q.is_correct === null ? 'รอตรวจ' : `${q.earned}/${q.points}`}
          </p>
          {q.type === 'short' && q.answer_id && (
            <GradeForm
              answerId={q.answer_id}
              max={q.points}
              initial={q.earned}
              attemptId={attemptId}
              quizId={quizId}
            />
          )}
        </li>
      ))}
    </ol>
  );
}

function GradeForm({
  answerId,
  max,
  initial,
  attemptId,
  quizId,
}: {
  answerId: string;
  max: number;
  initial: number | null;
  attemptId: string;
  quizId: string;
}) {
  const queryClient = useQueryClient();
  const [points, setPoints] = useState(initial?.toString() ?? '');
  const [feedback, setFeedback] = useState('');
  const grade = useMutation({
    mutationFn: () => gradeAnswer(answerId, Number(points), feedback),
    onSuccess: () => {
      toast.success('บันทึกคะแนนแล้ว');
      void queryClient.invalidateQueries({ queryKey: ['attempt-result', attemptId] });
      void queryClient.invalidateQueries({ queryKey: ['quiz-results', quizId] });
    },
    onError: (e) => toast.error(attemptErrorMessage(e)),
  });
  const valid = points !== '' && Number(points) >= 0 && Number(points) <= max;
  return (
    <form
      className="mt-2 flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) grade.mutate();
      }}
    >
      <div>
        <label htmlFor={`g-${answerId}`} className="block text-xs">
          คะแนน (เต็ม {max})
        </label>
        <input
          id={`g-${answerId}`}
          type="number"
          min={0}
          max={max}
          step={0.5}
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          className={`${inputClass} w-24`}
        />
      </div>
      <div className="min-w-40 flex-1">
        <label htmlFor={`f-${answerId}`} className="block text-xs">
          ความเห็น
        </label>
        <input
          id={`f-${answerId}`}
          value={feedback}
          maxLength={2000}
          onChange={(e) => setFeedback(e.target.value)}
          className={inputClass}
        />
      </div>
      <Button type="submit" size="sm" disabled={!valid || grade.isPending}>
        บันทึก
      </Button>
    </form>
  );
}

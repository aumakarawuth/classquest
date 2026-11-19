import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, CircleDashed, XCircle } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Card } from '@/components/ui/card';
import { formatThaiDateTime } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import { getAttemptResult, type AttemptResult } from '../attemptApi';

export default function AttemptResultPage() {
  const { attemptId = '' } = useParams();
  const query = useQuery({
    queryKey: ['attempt-result', attemptId],
    queryFn: () => getAttemptResult(attemptId),
  });
  if (query.isPending) return <PageSkeleton />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  const r = query.data;
  const pct = r.max_score ? Math.round(((r.score ?? 0) / r.max_score) * 100) : 0;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        to={`/student/quizzes/${r.quiz_id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        กลับไปที่แบบทดสอบ
      </Link>
      <Card className="space-y-2 text-center">
        <h1 className="text-lg font-semibold">ผลการทำแบบทดสอบ</h1>
        {r.status === 'graded' ? (
          <>
            <p className="text-4xl font-bold tabular-nums">
              {r.score}/{r.max_score}
            </p>
            <p
              className={cn(
                'font-medium',
                pct >= r.passing_percent ? 'text-success' : 'text-muted-foreground',
              )}
            >
              {pct}% · {pct >= r.passing_percent ? 'ผ่านเกณฑ์' : `ยังไม่ถึงเกณฑ์ ${r.passing_percent}%`}
            </p>
          </>
        ) : (
          <p>
            คะแนนเบื้องต้น {r.score}/{r.max_score} — รอครูตรวจข้อเขียน
          </p>
        )}
      </Card>
      {!r.answers_revealed ? (
        <Card>
          <p className="text-sm text-muted-foreground">
            {r.answers_visible_at
              ? `เฉลยจะแสดงเมื่อ ${formatThaiDateTime(r.answers_visible_at)}`
              : 'แบบทดสอบนี้ไม่แสดงเฉลย'}
          </p>
        </Card>
      ) : (
        <ol className="space-y-3">
          {r.questions.map((q, i) => (
            <ReviewItem key={q.id} q={q} n={i + 1} />
          ))}
        </ol>
      )}
    </div>
  );
}

function ReviewItem({ q, n }: { q: AttemptResult['questions'][number]; n: number }) {
  const Icon = q.is_correct === null ? CircleDashed : q.is_correct ? CheckCircle2 : XCircle;
  const verdict = q.is_correct === null ? 'รอตรวจ' : q.is_correct ? 'ถูก' : 'ผิด';
  return (
    <li>
      <Card className="space-y-2">
        <p className="flex items-start gap-2 font-medium">
          <Icon
            className={cn(
              'mt-0.5 size-5 shrink-0',
              q.is_correct
                ? 'text-success'
                : q.is_correct === false
                  ? 'text-destructive'
                  : 'text-muted-foreground',
            )}
            aria-hidden
          />
          <span>
            {n}. {q.stem}{' '}
            <span className="text-sm text-muted-foreground">
              ({verdict} · {q.earned ?? 0}/{q.points})
            </span>
          </span>
        </p>
        {q.type === 'short' ? (
          <p className="text-sm">
            คำตอบของคุณ: {q.my_text || '—'}
            {q.options.length > 0 && ` · คำตอบที่ยอมรับ: ${q.options.map((o) => o.label).join(', ')}`}
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {q.options.map((o) => (
              <li
                key={o.id}
                className={cn(
                  'rounded px-2 py-1',
                  o.is_correct && 'bg-success/15',
                  o.id === q.my_option_id && !o.is_correct && 'bg-destructive/10',
                )}
              >
                {o.label}
                {o.is_correct && ' ✓ คำตอบที่ถูก'}
                {o.id === q.my_option_id && ' ← คำตอบของคุณ'}
              </li>
            ))}
          </ul>
        )}
        {q.feedback && <p className="text-sm">ความเห็นครู: {q.feedback}</p>}
        {q.explanation && <p className="rounded bg-muted p-2 text-sm">{q.explanation}</p>}
      </Card>
    </li>
  );
}

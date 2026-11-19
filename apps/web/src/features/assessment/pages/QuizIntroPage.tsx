import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Play } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/features/auth/useAuth';
import { formatThaiDateTime } from '@/lib/datetime';
import { getQuiz, quizKindLabels } from '../api';
import { attemptErrorMessage, listMyAttempts, startAttempt } from '../attemptApi';

export default function QuizIntroPage() {
  const { quizId = '' } = useParams();
  const { userId } = useAuth();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['quiz-intro', quizId, userId],
    enabled: !!userId,
    queryFn: async () => {
      const [quiz, attempts] = await Promise.all([
        getQuiz(quizId),
        listMyAttempts(userId ?? '', [quizId]),
      ]);
      return { quiz, attempts };
    },
  });
  const start = useMutation({
    mutationFn: () => startAttempt(quizId),
    onSuccess: (p) => void navigate(`/student/attempts/${p.attempt_id}`, { state: p }),
    onError: (e) => toast.error(attemptErrorMessage(e)),
  });

  if (query.isPending) return <PageSkeleton />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  const { quiz, attempts } = query.data;
  if (!quiz) return <EmptyState title="ไม่พบแบบทดสอบ" />;
  const inProgress = attempts.find((a) => a.status === 'in_progress');
  const done = attempts.filter((a) => a.status !== 'in_progress');
  const canStart = !!inProgress || attempts.length < quiz.max_attempts;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        to={`/student/courses/${quiz.course_id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        กลับไปที่รายวิชา
      </Link>
      <Card className="space-y-4">
        <div>
          <p className="text-sm font-medium text-primary">{quizKindLabels[quiz.kind]}</p>
          <h1 className="text-2xl font-bold tracking-tight">{quiz.title}</h1>
        </div>
        {quiz.description && <p className="text-sm whitespace-pre-line">{quiz.description}</p>}
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted-foreground">เวลา</dt>
          <dd>{quiz.time_limit_minutes ? `${quiz.time_limit_minutes} นาที` : 'ไม่จำกัด'}</dd>
          <dt className="text-muted-foreground">ทำได้</dt>
          <dd>
            {attempts.length}/{quiz.max_attempts} ครั้ง
          </dd>
          <dt className="text-muted-foreground">เกณฑ์ผ่าน</dt>
          <dd>{quiz.passing_percent}%</dd>
          {quiz.available_until && (
            <>
              <dt className="text-muted-foreground">ปิดรับ</dt>
              <dd>{formatThaiDateTime(quiz.available_until)}</dd>
            </>
          )}
        </dl>
        {quiz.kind === 'pretest' && (
          <p className="rounded-lg bg-muted/60 p-3 text-sm">
            แบบทดสอบก่อนเรียนใช้ดูพื้นฐานเดิม ไม่มีผลต่อเกรด ตอบตามความเข้าใจของตนเอง
          </p>
        )}
        {canStart ? (
          <Button onClick={() => start.mutate()} disabled={start.isPending}>
            <Play aria-hidden />
            {inProgress ? 'ทำต่อ' : 'เริ่มทำแบบทดสอบ'}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">ทำครบจำนวนครั้งแล้ว</p>
        )}
      </Card>
      {done.length > 0 && (
        <section aria-labelledby="att-h" className="space-y-2">
          <h2 id="att-h" className="font-semibold">
            ผลการทำ
          </h2>
          <ul className="space-y-2">
            {done.map((a) => (
              <li key={a.id}>
                <Link to={`/student/attempts/${a.id}/result`} className="block rounded-lg">
                  <Card className="flex justify-between p-4 text-sm hover:border-primary/50">
                    <span>
                      ครั้งที่ {a.attempt_no} ·{' '}
                      {a.status === 'graded' ? `${a.score}/${a.max_score} คะแนน` : 'รอครูตรวจบางข้อ'}
                    </span>
                    {a.submitted_at && (
                      <time dateTime={a.submitted_at} className="text-muted-foreground">
                        {formatThaiDateTime(a.submitted_at)}
                      </time>
                    )}
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

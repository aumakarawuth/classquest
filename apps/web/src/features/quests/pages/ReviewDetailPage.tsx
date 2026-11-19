import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { inputClass } from '@/components/ui/field-utils';
import { Markdown } from '@/features/learning/components/Markdown';
import { formatThaiDateTime } from '@/lib/datetime';
import { signedFileUrl } from '../api';
import {
  getReviewSubmission,
  reviewErrorMessage,
  reviewSubmission,
  type RubricCriterion,
} from '../reviewApi';

export default function ReviewDetailPage() {
  const { submissionId = '' } = useParams();
  const query = useQuery({
    queryKey: ['reviews', 'detail', submissionId],
    queryFn: () => getReviewSubmission(submissionId),
  });
  const back = (
    <Link
      to="/teacher/reviews"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden />
      งานรอตรวจ
    </Link>
  );
  if (query.isPending) return <PageSkeleton />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  if (!query.data)
    return (
      <div className="space-y-6">
        {back}
        <EmptyState title="ไม่พบงาน" />
      </div>
    );
  const { submission: s, previous, reviews, criteria } = query.data;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {back}
      <header>
        <p className="text-sm text-muted-foreground">
          {s.profiles.display_name} · ครั้งที่ {s.attempt_no}
          {s.is_late && ' · ส่งช้า'}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{s.quests.title}</h1>
        <p className="text-sm text-muted-foreground">ส่งเมื่อ {formatThaiDateTime(s.submitted_at)}</p>
      </header>

      <Card className="space-y-3">
        <h2 className="font-semibold">งานที่ส่ง</h2>
        <SubmissionContent text={s.content_text} url={s.url} path={s.storage_path} />
      </Card>

      {s.status === 'submitted' ? (
        <ReviewForm
          submissionId={s.id}
          maxScore={s.quests.max_score}
          xp={s.quests.xp_reward}
          criteria={criteria}
        />
      ) : (
        <Card>
          <p className="text-sm">งานนี้ตรวจแล้ว</p>
        </Card>
      )}

      {previous.length > 0 && (
        <section aria-labelledby="prev-heading" className="space-y-2">
          <h2 id="prev-heading" className="font-semibold">
            การส่งครั้งก่อน
          </h2>
          {previous.map((p) => {
            const r = reviews.find((x) => x.submission_id === p.id);
            return (
              <Card key={p.id} className="space-y-2 p-4 text-sm">
                <p className="font-medium">
                  ครั้งที่ {p.attempt_no} · {formatThaiDateTime(p.submitted_at)}
                </p>
                <SubmissionContent text={p.content_text} url={p.url} path={p.storage_path} />
                {r && <p className="rounded bg-muted p-2">Feedback: {r.feedback || '—'}</p>}
              </Card>
            );
          })}
        </section>
      )}

      <details className="rounded-lg border p-4">
        <summary className="cursor-pointer font-medium">รายละเอียดภารกิจ</summary>
        <div className="pt-3">
          <Markdown>{s.quests.description_md || '—'}</Markdown>
        </div>
      </details>
    </div>
  );
}

function SubmissionContent({
  text,
  url,
  path,
}: {
  text: string | null;
  url: string | null;
  path: string | null;
}) {
  const open = useMutation({
    mutationFn: () => signedFileUrl(path ?? ''),
    onSuccess: (href) => window.open(href, '_blank', 'noopener'),
    onError: () => toast.error('เปิดไฟล์ไม่สำเร็จ'),
  });
  return (
    <div className="space-y-2 text-sm">
      {text && <p className="whitespace-pre-line">{text}</p>}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-primary underline"
        >
          {url}
        </a>
      )}
      {path && (
        <Button variant="outline" size="sm" onClick={() => open.mutate()} disabled={open.isPending}>
          เปิดไฟล์
        </Button>
      )}
    </div>
  );
}

function ReviewForm({
  submissionId,
  maxScore,
  xp,
  criteria,
}: {
  submissionId: string;
  maxScore: number;
  xp: number;
  criteria: RubricCriterion[];
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // one key per form instance: double-clicks and network retries never create a second review or XP award
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [points, setPoints] = useState<Record<string, string>>({});
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const useRubric = criteria.length > 0;
  const rubricTotal = criteria.reduce((sum, c) => sum + c.max_points, 0);
  const rubricSum = criteria.reduce((sum, c) => sum + (Number(points[c.id]) || 0), 0);
  const scaled = rubricTotal ? Math.round((rubricSum / rubricTotal) * maxScore * 100) / 100 : 0;

  const submit = useMutation({
    mutationFn: (decision: 'approved' | 'needs_revision') =>
      reviewSubmission({
        submissionId,
        decision,
        score: useRubric ? null : score === '' ? null : Number(score),
        feedback,
        rubric:
          useRubric && criteria.every((c) => points[c.id] !== undefined && points[c.id] !== '')
            ? criteria.map((c) => ({ criterion_id: c.id, points: Number(points[c.id]) }))
            : null,
        idempotencyKey,
      }),
    onSuccess: (_, decision) => {
      toast.success(decision === 'approved' ? `อนุมัติแล้ว นักเรียนได้รับ ${xp} XP` : 'ส่งกลับให้แก้ไขแล้ว');
      void queryClient.invalidateQueries({ queryKey: ['reviews'] });
      void navigate('/teacher/reviews');
    },
    onError: (e) => toast.error(reviewErrorMessage(e)),
  });

  return (
    <Card className="space-y-4">
      <h2 className="font-semibold">ผลการตรวจ</h2>
      {useRubric ? (
        <fieldset className="space-y-3">
          <legend className="text-sm text-muted-foreground">
            ให้คะแนนตามเกณฑ์ (ปรับเทียบเป็นคะแนนเต็ม {maxScore})
          </legend>
          {criteria.map((c) => (
            <div key={c.id} className="grid items-center gap-2 sm:grid-cols-[1fr_8rem]">
              <label htmlFor={`pts-${c.id}`} className="text-sm">
                <span className="font-medium">{c.name}</span>
                {c.description && (
                  <span className="block text-xs text-muted-foreground">{c.description}</span>
                )}
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={`pts-${c.id}`}
                  type="number"
                  min={0}
                  max={c.max_points}
                  step={0.5}
                  value={points[c.id] ?? ''}
                  onChange={(e) => setPoints((p) => ({ ...p, [c.id]: e.target.value }))}
                  className={inputClass}
                />
                <span className="text-sm text-muted-foreground">/{c.max_points}</span>
              </div>
            </div>
          ))}
          <p className="text-sm font-medium tabular-nums">
            คะแนนรวม {rubricSum}/{rubricTotal} → {scaled}/{maxScore}
          </p>
        </fieldset>
      ) : (
        <div className="space-y-1.5">
          <label htmlFor="review-score" className="block text-sm font-medium">
            คะแนน (เต็ม {maxScore})
          </label>
          <input
            id="review-score"
            type="number"
            min={0}
            max={maxScore}
            step={0.5}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className={`${inputClass} max-w-40`}
          />
        </div>
      )}
      <div className="space-y-1.5">
        <label htmlFor="review-feedback" className="block text-sm font-medium">
          Feedback ถึงนักเรียน
        </label>
        <textarea
          id="review-feedback"
          value={feedback}
          maxLength={5000}
          rows={4}
          onChange={(e) => setFeedback(e.target.value)}
          className={`${inputClass} py-2`}
          placeholder="จุดที่ทำได้ดี และสิ่งที่ควรปรับปรุง"
        />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          onClick={() => submit.mutate('needs_revision')}
          disabled={submit.isPending}
        >
          <RotateCcw aria-hidden />
          ส่งกลับให้แก้ไข
        </Button>
        <Button onClick={() => submit.mutate('approved')} disabled={submit.isPending}>
          <Check aria-hidden />
          อนุมัติ (+{xp} XP)
        </Button>
      </div>
    </Card>
  );
}

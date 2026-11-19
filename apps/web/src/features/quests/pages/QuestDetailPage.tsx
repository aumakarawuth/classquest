import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, FileUp, Lock, Send } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { inputClass } from '@/components/ui/field-utils';
import { useAuth } from '@/features/auth/useAuth';
import { Markdown } from '@/features/learning/components/Markdown';
import { questStageLabels } from '@/features/learning/resources';
import { formatThaiDateTime } from '@/lib/datetime';
import {
  questErrorMessage,
  signedFileUrl,
  submitQuest,
  uploadSubmissionFile,
  type Quest,
  type Submission,
} from '../api';
import {
  questStateLabels,
  questTypeLabels,
  validateSubmissionFile,
  type QuestState,
} from '../model';
import { listReviews, type Review } from '../reviewApi';
import { useStudentQuests } from '../useStudentQuests';

const statusLabels = { submitted: 'รอตรวจ', needs_revision: 'ต้องแก้ไข', approved: 'ผ่าน' } as const;

export default function QuestDetailPage() {
  const { questId = '' } = useParams();
  const query = useStudentQuests();
  const back = (
    <Link
      to="/student/quests"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden />
      ภารกิจทั้งหมด
    </Link>
  );

  if (query.isPending) return <PageSkeleton />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  const item = query.data.find((x) => x.quest.id === questId);
  if (!item)
    return (
      <div className="space-y-6">
        {back}
        <EmptyState title="ไม่พบภารกิจ" description="ภารกิจนี้อาจยังไม่เผยแพร่" />
      </div>
    );
  const { quest, history, state } = item;
  const prereqTitles = quest.quest_prerequisites
    .map((p) => query.data.find((x) => x.quest.id === p.required_quest_id)?.quest.title)
    .filter(Boolean);

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      {back}
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary">
          {questTypeLabels[quest.type]}
          {quest.quest_stage && ` · ${questStageLabels[quest.quest_stage]}`}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{quest.title}</h1>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <div>
            <dt className="inline">สถานะ: </dt>
            <dd className="inline font-medium text-foreground">{questStateLabels[state]}</dd>
          </div>
          <div>
            <dt className="inline">คะแนนเต็ม: </dt>
            <dd className="inline">{quest.max_score}</dd>
          </div>
          <div>
            <dt className="inline">XP: </dt>
            <dd className="inline">{quest.xp_reward}</dd>
          </div>
          <div>
            <dt className="inline">ส่งได้: </dt>
            <dd className="inline">
              {history.length}/{quest.max_attempts} ครั้ง
            </dd>
          </div>
          {quest.due_at && (
            <div>
              <dt className="inline">กำหนดส่ง: </dt>
              <dd className="inline">
                {formatThaiDateTime(quest.due_at)}
                {quest.allow_late ? ' (รับงานช้า)' : ''}
              </dd>
            </div>
          )}
        </dl>
      </header>

      {quest.objectives.trim() && (
        <Card className="space-y-2">
          <h2 className="font-semibold">จุดประสงค์การเรียนรู้</h2>
          <p className="text-sm whitespace-pre-line">{quest.objectives}</p>
        </Card>
      )}
      {quest.description_md.trim() && (
        <Card>
          <Markdown>{quest.description_md}</Markdown>
        </Card>
      )}

      {state === 'locked' ? (
        <EmptyState
          icon={Lock}
          title="ภารกิจนี้ยังล็อกอยู่"
          description={prereqTitles.length ? `ต้องผ่าน: ${prereqTitles.join(', ')}` : undefined}
        />
      ) : state === 'available' || state === 'needs_revision' ? (
        <SubmitForm quest={quest} state={state} />
      ) : (
        <Card>
          <p className="text-sm">
            {state === 'closed' ? 'ภารกิจนี้ปิดรับงานแล้ว' : questStateLabels[state]}
          </p>
        </Card>
      )}

      {history.length > 0 && (
        <section aria-labelledby="history-heading" className="space-y-3">
          <h2 id="history-heading" className="font-semibold">
            ประวัติการส่งงาน
          </h2>
          <History history={history} />
        </section>
      )}
    </article>
  );
}

function SubmitForm({ quest, state }: { quest: Quest; state: QuestState }) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const modes = quest.submit_modes;
  const onlyClassroom = modes.length === 1 && modes[0] === 'classroom';

  const submit = useMutation({
    mutationFn: async () => {
      const path = file ? await uploadSubmissionFile(quest.course_id, userId ?? '', file) : null;
      await submitQuest(quest.id, text.trim() || null, url.trim() || null, path);
    },
    onSuccess: () => {
      toast.success('ส่งงานแล้ว รอครูตรวจ');
      setText('');
      setUrl('');
      setFile(null);
      void queryClient.invalidateQueries({ queryKey: ['quests'] });
    },
    onError: (e) => toast.error(questErrorMessage(e)),
  });

  return (
    <Card className="space-y-4">
      <h2 className="font-semibold">{state === 'needs_revision' ? 'ส่งงานฉบับแก้ไข' : 'ส่งงาน'}</h2>
      {modes.includes('classroom') && quest.classroom_url && (
        <div className="space-y-2 rounded-lg bg-muted/60 p-3 text-sm">
          <p>ภารกิจนี้ให้ส่งงานใน Google Classroom{onlyClassroom ? '' : ' หรือส่งที่นี่'}</p>
          <a
            href={quest.classroom_url}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <ExternalLink aria-hidden />
            เปิดงานใน Google Classroom
          </a>
        </div>
      )}
      {!onlyClassroom && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim() && !url.trim() && !file) {
              toast.error('กรุณาใส่คำตอบ ลิงก์ หรือไฟล์');
              return;
            }
            submit.mutate();
          }}
        >
          {modes.includes('text') && (
            <div className="space-y-1.5">
              <label htmlFor="sub-text" className="block text-sm font-medium">
                คำตอบ
              </label>
              <textarea
                id="sub-text"
                value={text}
                maxLength={10000}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                className={`${inputClass} py-2`}
              />
            </div>
          )}
          {modes.includes('url') && (
            <div className="space-y-1.5">
              <label htmlFor="sub-url" className="block text-sm font-medium">
                ลิงก์ผลงาน
              </label>
              <input
                id="sub-url"
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://drive.google.com/... หรือ https://wokwi.com/..."
                className={inputClass}
                aria-describedby="sub-url-hint"
              />
              <p id="sub-url-hint" className="text-xs text-muted-foreground">
                ลิงก์ต้องขึ้นต้นด้วย https:// และแชร์ให้ครูเปิดได้
              </p>
            </div>
          )}
          {modes.includes('file') && (
            <div className="space-y-1.5">
              <label htmlFor="sub-file" className="block text-sm font-medium">
                ไฟล์ (PNG, JPEG, WebP, PDF ไม่เกิน 2 MB)
              </label>
              <input
                id="sub-file"
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                aria-describedby={fileError ? 'sub-file-error' : undefined}
                aria-invalid={fileError ? true : undefined}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  const err = f ? validateSubmissionFile(f) : null;
                  setFileError(err);
                  setFile(err ? null : f);
                  if (err) e.target.value = '';
                }}
                className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-muted file:px-4"
              />
              {fileError && (
                <p id="sub-file-error" role="alert" className="text-xs text-destructive">
                  {fileError}
                </p>
              )}
            </div>
          )}
          <Button type="submit" disabled={submit.isPending}>
            {file ? <FileUp aria-hidden /> : <Send aria-hidden />}
            {submit.isPending ? 'กำลังส่ง…' : 'ส่งงาน'}
          </Button>
        </form>
      )}
    </Card>
  );
}

function History({ history }: { history: Submission[] }) {
  const reviews = useQuery({
    queryKey: ['quests', 'my-reviews', history.map((h) => h.id).join(',')],
    queryFn: () => listReviews(history.map((h) => h.id)),
  });
  return (
    <ol className="space-y-2">
      {history.map((s) => (
        <HistoryItem
          key={s.id}
          submission={s}
          review={reviews.data?.find((r) => r.submission_id === s.id)}
        />
      ))}
    </ol>
  );
}

function HistoryItem({ submission: s, review }: { submission: Submission; review?: Review }) {
  const open = useMutation({
    mutationFn: () => signedFileUrl(s.storage_path ?? ''),
    onSuccess: (href) => window.open(href, '_blank', 'noopener'),
    onError: () => toast.error('เปิดไฟล์ไม่สำเร็จ'),
  });
  return (
    <li>
      <Card className="space-y-2 p-4 text-sm">
        <div className="flex flex-wrap justify-between gap-2">
          <span className="font-medium">
            ครั้งที่ {s.attempt_no} · {statusLabels[s.status]}
            {s.is_late && ' · ส่งช้า'}
          </span>
          <time dateTime={s.submitted_at} className="text-xs text-muted-foreground">
            {formatThaiDateTime(s.submitted_at)}
          </time>
        </div>
        {s.content_text && <p className="whitespace-pre-line">{s.content_text}</p>}
        {s.url && (
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-primary underline"
          >
            {s.url}
          </a>
        )}
        {s.storage_path && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => open.mutate()}
            disabled={open.isPending}
          >
            เปิดไฟล์ที่ส่ง
          </Button>
        )}
        {review && (
          <div className="rounded-lg bg-muted p-3">
            <p className="font-medium">
              ผลการตรวจ: {review.decision === 'approved' ? 'ผ่าน' : 'ต้องแก้ไข'}
              {review.score !== null && ` · คะแนน ${review.score}`}
            </p>
            {review.feedback && <p className="whitespace-pre-line">{review.feedback}</p>}
          </div>
        )}
      </Card>
    </li>
  );
}

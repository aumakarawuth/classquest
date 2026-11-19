import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Lock, Pin, Printer, Sparkles, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { inputClass } from '@/components/ui/field-utils';
import { CompetencyReport } from '@/features/competency/components/CompetencyReport';
import { formatThaiDateTime } from '@/lib/datetime';
import {
  addReflection,
  deleteReflection,
  featureWork,
  getPortfolio,
  reflectionPrompts,
  removeItem,
  savePortfolioSettings,
  type ApprovedWork,
  type PortfolioData,
} from '../api';

interface Props {
  courseId: string;
  userId: string;
  courseTitle: string;
  studentName: string;
  editable: boolean;
}

export function PortfolioView({ courseId, userId, courseTitle, studentName, editable }: Props) {
  const query = useQuery({
    queryKey: ['portfolio', courseId, userId],
    queryFn: () => getPortfolio(courseId, userId),
  });
  if (query.isPending) return <PageSkeleton />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  const p = query.data;
  const featured = p.items
    .map((i) => ({ item: i, work: p.works.find((w) => w.id === i.submission_id) }))
    .filter((x): x is { item: (typeof p.items)[number]; work: ApprovedWork } => !!x.work);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">{courseTitle}</p>
        <h1 className="text-2xl font-bold tracking-tight">แฟ้มสะสมผลงาน — {studentName}</h1>
        {p.headline && <p className="text-muted-foreground">{p.headline}</p>}
      </header>
      {editable && <Settings p={p} courseId={courseId} userId={userId} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">XP สะสม</p>
          <p className="text-2xl font-bold tabular-nums">{p.xp.toLocaleString('th-TH')}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">ภารกิจที่ผ่าน</p>
          <p className="text-2xl font-bold tabular-nums">
            {new Set(p.works.map((w) => w.quest_id)).size}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Badge</p>
          <p className="text-2xl font-bold tabular-nums">{p.badges.length}</p>
        </Card>
      </div>
      <section aria-labelledby="pf-featured" className="space-y-3">
        <h2 id="pf-featured" className="text-lg font-semibold">
          ผลงานเด่น
        </h2>
        {featured.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {editable ? 'ปักหมุดผลงานจากรายการด้านล่าง' : 'ยังไม่มีผลงานเด่น'}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {featured.map(({ item, work }) => (
              <li key={item.id}>
                <WorkCard
                  work={work}
                  title={item.title}
                  itemId={editable ? item.id : undefined}
                  courseId={courseId}
                  userId={userId}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
      {editable && <PinWorks p={p} courseId={courseId} userId={userId} />}
      {p.badges.length > 0 && (
        <section aria-labelledby="pf-badges" className="space-y-2">
          <h2 id="pf-badges" className="text-lg font-semibold">
            Badge ที่ได้รับ
          </h2>
          <ul className="flex flex-wrap gap-2">
            {p.badges.map((b) => (
              <li
                key={b.name + b.created_at}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm"
              >
                <Award className="size-4" aria-hidden />
                {b.name}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="pf-comp" className="space-y-2">
        <h2 id="pf-comp" className="text-lg font-semibold">
          หลักฐานสมรรถนะ
        </h2>
        <CompetencyReport courseId={courseId} userId={userId} />
      </section>
      <Reflections p={p} courseId={courseId} userId={userId} editable={editable} />
    </div>
  );
}

function Settings({ p, courseId, userId }: { p: PortfolioData; courseId: string; userId: string }) {
  const queryClient = useQueryClient();
  const [visibility, setVisibility] = useState(p.visibility);
  const [headline, setHeadline] = useState(p.headline);
  const save = useMutation({
    mutationFn: () => savePortfolioSettings(userId, courseId, visibility, headline.trim()),
    onSuccess: () => {
      toast.success('บันทึกแล้ว');
      void queryClient.invalidateQueries({ queryKey: ['portfolio', courseId, userId] });
    },
    onError: () => toast.error('บันทึกไม่สำเร็จ'),
  });
  return (
    <Card className="space-y-3 print:hidden">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="space-y-1">
          <label htmlFor="pf-headline" className="block text-sm font-medium">
            แนะนำตัว / เป้าหมาย
          </label>
          <input
            id="pf-headline"
            value={headline}
            maxLength={300}
            onChange={(e) => setHeadline(e.target.value)}
            className={inputClass}
          />
        </div>
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium">ใครเห็นแฟ้มนี้</legend>
          <div className="flex gap-2">
            {(['private', 'teacher'] as const).map((v) => (
              <label
                key={v}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm has-checked:border-primary has-checked:bg-primary/5"
              >
                <input
                  type="radio"
                  name="pf-vis"
                  checked={visibility === v}
                  onChange={() => setVisibility(v)}
                  className="accent-[var(--primary)]"
                />
                {v === 'private' ? (
                  <>
                    <Lock className="size-4" aria-hidden />
                    เฉพาะฉัน
                  </>
                ) : (
                  <>
                    <Users className="size-4" aria-hidden />
                    ครูผู้สอน
                  </>
                )}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          บันทึก
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer aria-hidden />
          พิมพ์ / บันทึก PDF
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        งานที่ส่งและบันทึกสะท้อนผล ครูผู้สอนดูได้อยู่แล้วเพื่อการประเมิน การตั้งค่านี้ควบคุมเฉพาะหน้าแฟ้มสะสมผลงาน
      </p>
    </Card>
  );
}

function WorkCard({
  work,
  title,
  itemId,
  courseId,
  userId,
}: {
  work: ApprovedWork;
  title?: string;
  itemId?: string;
  courseId: string;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => removeItem(itemId ?? ''),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['portfolio', courseId, userId] }),
  });
  const review = work.quest_reviews[0];
  return (
    <Card className="h-full space-y-2 break-inside-avoid">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">
            {work.quests.title} · {formatThaiDateTime(work.submitted_at)}
          </p>
          <h3 className="font-semibold">{title ?? work.quests.title}</h3>
        </div>
        {itemId && (
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="icon" aria-label="เลิกปักหมุด" className="print:hidden">
                <Trash2 aria-hidden />
              </Button>
            }
            title="เลิกปักหมุดผลงานนี้?"
            description="งานที่ส่งยังอยู่ในระบบ"
            confirmLabel="เลิกปักหมุด"
            onConfirm={() => remove.mutate()}
          />
        )}
      </div>
      {work.content_text && (
        <p className="line-clamp-4 text-sm whitespace-pre-line">{work.content_text}</p>
      )}
      {work.url && (
        <a
          href={work.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-sm text-primary underline"
        >
          {work.url}
        </a>
      )}
      {review?.feedback && (
        <p className="rounded bg-muted p-2 text-sm">
          <span className="font-medium">ความเห็นครู:</span> {review.feedback}
        </p>
      )}
    </Card>
  );
}

function PinWorks({ p, courseId, userId }: { p: PortfolioData; courseId: string; userId: string }) {
  const queryClient = useQueryClient();
  const pinned = new Set(p.items.map((i) => i.submission_id));
  const candidates = p.works.filter((w) => !pinned.has(w.id));
  const pin = useMutation({
    mutationFn: async (w: ApprovedWork) => {
      if (!p.exists) await savePortfolioSettings(userId, courseId, p.visibility, p.headline);
      await featureWork(userId, courseId, w.id, w.quests.title, p.items.length + 1);
    },
    onSuccess: () => {
      toast.success('ปักหมุดแล้ว');
      void queryClient.invalidateQueries({ queryKey: ['portfolio', courseId, userId] });
    },
    onError: () => toast.error('ปักหมุดไม่สำเร็จ'),
  });
  if (!candidates.length) return null;
  return (
    <details className="rounded-lg border p-4 print:hidden">
      <summary className="cursor-pointer font-medium">
        งานที่ผ่านแล้ว ({candidates.length}) — เลือกเป็นผลงานเด่น
      </summary>
      <ul className="mt-3 space-y-2">
        {candidates.map((w) => (
          <li key={w.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{w.quests.title}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => pin.mutate(w)}
              disabled={pin.isPending}
            >
              <Pin aria-hidden />
              ปักหมุด
            </Button>
          </li>
        ))}
      </ul>
    </details>
  );
}

function Reflections({
  p,
  courseId,
  userId,
  editable,
}: {
  p: PortfolioData;
  courseId: string;
  userId: string;
  editable: boolean;
}) {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState(reflectionPrompts[0] ?? '');
  const [body, setBody] = useState('');
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: ['portfolio', courseId, userId] });
  const add = useMutation({
    mutationFn: () => addReflection(userId, courseId, prompt, body.trim()),
    onSuccess: () => {
      toast.success('บันทึกการสะท้อนผลแล้ว');
      setBody('');
      refresh();
    },
    onError: () => toast.error('บันทึกไม่สำเร็จ'),
  });
  const del = useMutation({ mutationFn: deleteReflection, onSuccess: refresh });
  return (
    <section aria-labelledby="pf-refl" className="space-y-3">
      <h2 id="pf-refl" className="flex items-center gap-2 text-lg font-semibold">
        <Sparkles className="size-5 text-accent" aria-hidden />
        การสะท้อนผลการเรียนรู้
      </h2>
      {editable && (
        <Card className="space-y-2 print:hidden">
          <label htmlFor="refl-prompt" className="block text-sm font-medium">
            หัวข้อ
          </label>
          <select
            id="refl-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className={inputClass}
          >
            {reflectionPrompts.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
          <label htmlFor="refl-body" className="block text-sm font-medium">
            สิ่งที่อยากบันทึก
          </label>
          <textarea
            id="refl-body"
            rows={4}
            maxLength={5000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={`${inputClass} py-2`}
          />
          <Button onClick={() => add.mutate()} disabled={!body.trim() || add.isPending}>
            บันทึก
          </Button>
        </Card>
      )}
      {p.reflections.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีการสะท้อนผล</p>
      ) : (
        <ul className="space-y-2">
          {p.reflections.map((r) => (
            <li key={r.id}>
              <Card className="space-y-1 break-inside-avoid">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{r.prompt || 'บันทึก'}</p>
                  {editable && (
                    <ConfirmDialog
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="ลบบันทึก"
                          className="print:hidden"
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      }
                      title="ลบบันทึกนี้?"
                      description="ไม่สามารถย้อนกลับได้"
                      confirmLabel="ลบ"
                      destructive
                      onConfirm={() => del.mutate(r.id)}
                    />
                  )}
                </div>
                <p className="text-sm whitespace-pre-line">{r.body}</p>
                <time dateTime={r.created_at} className="text-xs text-muted-foreground">
                  {formatThaiDateTime(r.created_at)}
                </time>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

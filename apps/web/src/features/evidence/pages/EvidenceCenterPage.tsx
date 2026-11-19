import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Pencil, Plus, Printer, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { inputClass } from '@/components/ui/field-utils';
import { useAuth } from '@/features/auth/useAuth';
import { listMyCourses } from '@/features/courses/api';
import { Markdown } from '@/features/learning/components/Markdown';
import { cn } from '@/lib/utils';
import {
  categoryLabels,
  deleteEvidence,
  evidenceCategories,
  listEvidence,
  saveEvidence,
  type Evidence,
  type EvidenceCategory,
} from '../api';
import { SurveyManager } from '../components/SurveyManager';

const autoNotes: Partial<
  Record<EvidenceCategory, { text: string; to: (c: string) => string; label: string }>
> = {
  prepost_results: {
    text: 'ระบบคำนวณจากแบบทดสอบจริง (รหัสนิรนาม)',
    to: (c) => `/teacher/courses/${c}/prepost`,
    label: 'เปิดรายงานก่อน–หลังเรียน',
  },
  competency_results: {
    text: 'สรุปจำนวนผู้ผ่านต่อสมรรถนะจากหลักฐานจริง',
    to: (c) => `/teacher/courses/${c}/competency-matrix`,
    label: 'เปิดตารางสมรรถนะ',
  },
};

export default function EvidenceCenterPage() {
  const { userId } = useAuth();
  const courses = useQuery({
    queryKey: ['courses', 'teacher', userId],
    queryFn: () => listMyCourses(userId ?? '', 'teacher'),
    enabled: !!userId,
  });
  const [courseId, setCourseId] = useState('');
  const [category, setCategory] = useState<EvidenceCategory>('problem_needs');
  const selected = courseId || courses.data?.[0]?.id || '';
  const evidence = useQuery({
    queryKey: ['evidence', selected],
    queryFn: () => listEvidence(selected),
    enabled: !!selected,
  });

  if (courses.isPending) return <PageSkeleton />;
  if (!courses.data?.length) return <EmptyState title="ยังไม่มีรายวิชา" />;
  const counts = Object.fromEntries(
    evidenceCategories.map((c) => [c, evidence.data?.filter((e) => e.category === c).length ?? 0]),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ศูนย์หลักฐานการประกวด</h1>
          <p className="text-sm text-muted-foreground">
            รวบรวมหลักฐานตามหัวข้อการประกวด ข้อมูลผลการเรียนดึงจากระบบจริงเท่านั้น
          </p>
        </div>
        {selected && (
          <Link to={`/teacher/courses/${selected}/evidence/report`} className={buttonVariants()}>
            <Printer aria-hidden />
            รายงานพร้อมพิมพ์
          </Link>
        )}
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="ev-course" className="text-sm font-medium">
          รายวิชา
        </label>
        <select
          id="ev-course"
          value={selected}
          onChange={(e) => setCourseId(e.target.value)}
          className={`${inputClass} max-w-md`}
        >
          {courses.data.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} {c.name} ({c.term}/{c.academicYear})
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <nav aria-label="หมวดหลักฐาน">
          <ul className="space-y-1">
            {evidenceCategories.map((c, i) => (
              <li key={c}>
                <button
                  type="button"
                  onClick={() => setCategory(c)}
                  aria-current={category === c ? 'true' : undefined}
                  className={cn(
                    'flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-sm hover:bg-muted',
                    category === c && 'bg-primary/10 font-medium text-primary',
                  )}
                >
                  <span>
                    {i + 1}. {categoryLabels[c]}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">{counts[c]}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <section aria-labelledby="ev-cat-h" className="space-y-3">
          <h2 id="ev-cat-h" className="text-lg font-semibold">
            {categoryLabels[category]}
          </h2>
          {autoNotes[category] && (
            <Card className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
              <span>{autoNotes[category]?.text}</span>
              <Link
                to={autoNotes[category]?.to(selected) ?? '#'}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                {autoNotes[category]?.label}
              </Link>
            </Card>
          )}
          {category === 'satisfaction' && <SurveyManager courseId={selected} />}
          <EvidenceList
            courseId={selected}
            category={category}
            items={evidence.data?.filter((e) => e.category === category) ?? []}
          />
        </section>
      </div>
    </div>
  );
}

function EvidenceList({
  courseId,
  category,
  items,
}: {
  courseId: string;
  category: EvidenceCategory;
  items: Evidence[];
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Evidence | 'new' | null>(null);
  const remove = useMutation({
    mutationFn: deleteEvidence,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['evidence', courseId] }),
  });
  return (
    <div className="space-y-3">
      <Button variant="outline" size="sm" onClick={() => setEditing('new')}>
        <Plus aria-hidden />
        เพิ่มหลักฐาน
      </Button>
      {editing && (
        <EvidenceForm
          key={editing === 'new' ? 'new' : editing.id}
          courseId={courseId}
          category={category}
          evidence={editing === 'new' ? null : editing}
          onDone={() => setEditing(null)}
        />
      )}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีหลักฐานในหมวดนี้</p>
      ) : (
        <ul className="space-y-2">
          {items.map((e) => (
            <li key={e.id}>
              <Card className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{e.title}</h3>
                    {e.occurred_on && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(`${e.occurred_on}T00:00:00+07:00`).toLocaleDateString('th-TH', {
                          dateStyle: 'medium',
                          timeZone: 'Asia/Bangkok',
                        })}
                      </p>
                    )}
                  </div>
                  <div className="flex">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`แก้ไข ${e.title}`}
                      onClick={() => setEditing(e)}
                    >
                      <Pencil aria-hidden />
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="icon" aria-label={`ลบ ${e.title}`}>
                          <Trash2 aria-hidden />
                        </Button>
                      }
                      title="ลบหลักฐาน?"
                      description="ไม่สามารถย้อนกลับได้"
                      confirmLabel="ลบ"
                      destructive
                      onConfirm={() => remove.mutate(e.id)}
                    />
                  </div>
                </div>
                {e.body_md && <Markdown>{e.body_md}</Markdown>}
                {e.url && (
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary underline"
                  >
                    <FileText className="size-4" aria-hidden />
                    เปิดไฟล์/ลิงก์
                  </a>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EvidenceForm({
  courseId,
  category,
  evidence,
  onDone,
}: {
  courseId: string;
  category: EvidenceCategory;
  evidence: Evidence | null;
  onDone: () => void;
}) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(evidence?.title ?? '');
  const [body, setBody] = useState(evidence?.body_md ?? '');
  const [url, setUrl] = useState(evidence?.url ?? '');
  const [date, setDate] = useState(evidence?.occurred_on ?? '');
  const urlValid = !url || /^https:\/\//.test(url);
  const save = useMutation({
    mutationFn: () =>
      saveEvidence(courseId, userId ?? '', evidence?.id ?? null, {
        category,
        title: title.trim(),
        body_md: body,
        url: url.trim() || null,
        occurred_on: date || null,
      }),
    onSuccess: () => {
      toast.success('บันทึกหลักฐานแล้ว');
      void queryClient.invalidateQueries({ queryKey: ['evidence', courseId] });
      onDone();
    },
    onError: () => toast.error('บันทึกไม่สำเร็จ'),
  });
  return (
    <Card>
      <form
        className="grid gap-3 sm:grid-cols-[1fr_12rem]"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim() && urlValid) save.mutate();
        }}
      >
        <div className="space-y-1">
          <label htmlFor="ev-title" className="block text-sm font-medium">
            ชื่อหลักฐาน
          </label>
          <input
            id="ev-title"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="ev-date" className="block text-sm font-medium">
            วันที่
          </label>
          <input
            id="ev-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="ev-body" className="block text-sm font-medium">
            รายละเอียด (Markdown)
          </label>
          <textarea
            id="ev-body"
            rows={6}
            value={body}
            maxLength={50000}
            onChange={(e) => setBody(e.target.value)}
            className={`${inputClass} py-2`}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="ev-url" className="block text-sm font-medium">
            ลิงก์ไฟล์ (เช่น Google Drive)
          </label>
          <input
            id="ev-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-invalid={!urlValid || undefined}
            className={inputClass}
          />
          {!urlValid && <p className="text-xs text-destructive">ลิงก์ต้องขึ้นต้นด้วย https://</p>}
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          ห้ามใส่ชื่อจริงหรือข้อมูลส่วนบุคคลของนักเรียนในหลักฐานที่จะเผยแพร่ ใช้รหัสนิรนาม (S01, S02…)
        </p>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="outline" onClick={onDone}>
            ยกเลิก
          </Button>
          <Button type="submit" disabled={!title.trim() || !urlValid || save.isPending}>
            บันทึก
          </Button>
        </div>
      </form>
    </Card>
  );
}

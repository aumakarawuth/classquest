import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { fieldA11y, inputClass } from '@/components/ui/field-utils';
import { cn } from '@/lib/utils';
import {
  addResource,
  deleteResource,
  getLesson,
  learningErrorMessage,
  listCourseLessons,
  reorderResources,
  updateLesson,
  type LessonDetail,
} from '../api';
import { Markdown } from '../components/Markdown';
import { ResourceView } from '../components/ResourceView';
import {
  moveItem,
  questStageLabels,
  questStages,
  resourceFormSchema,
  resourceMeta,
  resourceTypes,
  type ResourceFormValues,
} from '../resources';

export default function LessonEditorPage() {
  const { courseId = '', lessonId = '' } = useParams();
  const query = useQuery({ queryKey: ['lesson', lessonId], queryFn: () => getLesson(lessonId) });

  return (
    <div className="space-y-6">
      <Link
        to={`/teacher/courses/${courseId}/builder`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        กลับไปที่การออกแบบรายวิชา
      </Link>
      {query.isPending ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <EmptyState title="ไม่พบบทเรียน" />
      ) : (
        <>
          <LessonForm lesson={query.data} />
          <Resources lesson={query.data} />
        </>
      )}
    </div>
  );
}

const lessonFormSchema = z.object({
  title: z.string().trim().min(1, 'กรุณากรอกชื่อบทเรียน').max(200, 'ไม่เกิน 200 ตัวอักษร'),
  body_md: z.string().max(50000, 'ไม่เกิน 50,000 ตัวอักษร'),
  quest_stage: z.enum([...questStages, '']),
  prerequisite_lesson_id: z.string(),
  estimated_minutes: z.string().regex(/^\d{0,3}$/, 'กรอกเป็นนาที (ตัวเลข)'),
  published: z.boolean(),
});
type LessonFormValues = z.infer<typeof lessonFormSchema>;

function LessonForm({ lesson }: { lesson: LessonDetail }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const others = useQuery({
    queryKey: ['course-lessons', lesson.course_id],
    queryFn: () => listCourseLessons(lesson.course_id),
  });
  const form = useForm<LessonFormValues>({
    resolver: zodResolver(lessonFormSchema),
    defaultValues: {
      title: lesson.title,
      body_md: lesson.body_md,
      quest_stage: lesson.quest_stage ?? '',
      prerequisite_lesson_id: lesson.prerequisite_lesson_id ?? '',
      estimated_minutes: lesson.estimated_minutes?.toString() ?? '',
      published: lesson.published,
    },
  });
  const errors = form.formState.errors;
  const body = useWatch({ control: form.control, name: 'body_md' });

  const save = useMutation({
    mutationFn: (v: LessonFormValues) =>
      updateLesson(lesson.id, {
        title: v.title,
        body_md: v.body_md,
        quest_stage: v.quest_stage || null,
        prerequisite_lesson_id: v.prerequisite_lesson_id || null,
        estimated_minutes: v.estimated_minutes ? Number(v.estimated_minutes) : null,
        published: v.published,
      }),
    onSuccess: (_, v) => {
      toast.success('บันทึกบทเรียนแล้ว');
      form.reset(v);
      void queryClient.invalidateQueries({ queryKey: ['lesson', lesson.id] });
      void queryClient.invalidateQueries({ queryKey: ['builder', lesson.course_id] });
    },
    onError: (e) => toast.error(learningErrorMessage(e)),
  });

  return (
    <Card>
      <form noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold tracking-tight">แก้ไขบทเรียน</h1>
          <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              {...form.register('published')}
              className="size-5 accent-[var(--primary)]"
            />
            เผยแพร่ให้นักเรียนเห็น
          </label>
        </div>
        <Field id="title" label="ชื่อบทเรียน" error={errors.title?.message}>
          <input
            {...form.register('title')}
            {...fieldA11y('title', errors.title?.message)}
            className={inputClass}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="quest_stage" label="ขั้นตอน QUEST">
            <select {...form.register('quest_stage')} id="quest_stage" className={inputClass}>
              <option value="">ไม่กำหนด</option>
              {questStages.map((s) => (
                <option key={s} value={s}>
                  {questStageLabels[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            id="prerequisite_lesson_id"
            label="ต้องเรียนบทนี้ก่อน"
            hint="นักเรียนจะปลดล็อกเมื่อเรียนบทก่อนหน้าจบ"
          >
            <select
              {...form.register('prerequisite_lesson_id')}
              {...fieldA11y('prerequisite_lesson_id', undefined, 'นักเรียนจะปลดล็อกเมื่อเรียนบทก่อนหน้าจบ')}
              className={inputClass}
            >
              <option value="">ไม่มี</option>
              {others.data
                ?.filter((l) => l.id !== lesson.id)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
            </select>
          </Field>
          <Field
            id="estimated_minutes"
            label="เวลาโดยประมาณ (นาที)"
            error={errors.estimated_minutes?.message}
          >
            <input
              inputMode="numeric"
              {...form.register('estimated_minutes')}
              {...fieldA11y('estimated_minutes', errors.estimated_minutes?.message)}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="body_md" className="text-sm font-medium">
              เนื้อหาบทเรียน (Markdown)
            </label>
            <div
              role="tablist"
              aria-label="โหมดแก้ไขเนื้อหา"
              className="inline-flex rounded-lg border p-0.5 text-sm"
            >
              {(['write', 'preview'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'min-h-9 rounded-md px-3',
                    tab === t && 'bg-primary text-primary-foreground',
                  )}
                >
                  {t === 'write' ? 'เขียน' : 'ดูตัวอย่าง'}
                </button>
              ))}
            </div>
          </div>
          {tab === 'write' ? (
            <textarea
              {...form.register('body_md')}
              id="body_md"
              rows={14}
              className={`${inputClass} py-2 font-mono`}
              placeholder={'## สถานการณ์ปัญหา\nบ้านของคุณต้องการระบบเปิดไฟอัตโนมัติ...'}
            />
          ) : (
            <div className="min-h-40 rounded-lg border p-4">
              {body.trim() ? (
                <Markdown>{body}</Markdown>
              ) : (
                <p className="text-sm text-muted-foreground">ยังไม่มีเนื้อหา</p>
              )}
            </div>
          )}
          {errors.body_md && <p className="text-xs text-destructive">{errors.body_md.message}</p>}
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={save.isPending || !form.formState.isDirty}>
            {save.isPending ? 'กำลังบันทึก…' : 'บันทึกบทเรียน'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Resources({ lesson }: { lesson: LessonDetail }) {
  const queryClient = useQueryClient();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['lesson', lesson.id] });
  const onError = (e: unknown) => {
    toast.error(learningErrorMessage(e));
    refresh();
  };
  const resources = lesson.lesson_resources;

  const form = useForm<ResourceFormValues>({
    resolver: zodResolver(resourceFormSchema),
    defaultValues: { type: 'youtube', title: '', url: '', content: '' },
  });
  const type = useWatch({ control: form.control, name: 'type' });
  const meta = resourceMeta[type];
  const errors = form.formState.errors;

  const add = useMutation({
    mutationFn: (v: ResourceFormValues) =>
      addResource(lesson.id, Math.max(0, ...resources.map((r) => r.position)) + 1, v),
    onSuccess: () => {
      toast.success('เพิ่มสื่อแล้ว');
      form.reset({ type, title: '', url: '', content: '' });
      refresh();
    },
    onError,
  });
  const remove = useMutation({ mutationFn: deleteResource, onSuccess: refresh, onError });
  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderResources(lesson.id, ids),
    onSuccess: refresh,
    onError,
  });

  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold">สื่อการเรียนรู้</h2>
      {resources.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีสื่อ เพิ่มวิดีโอ ลิงก์ หรือโค้ดตัวอย่างด้านล่าง</p>
      ) : (
        <ol className="space-y-3">
          {resources.map((r, index) => (
            <li key={r.id} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {index + 1}. {resourceMeta[r.type].label}
                  {r.title && ` — ${r.title}`}
                </span>
                <div className="flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="เลื่อนขึ้น"
                    disabled={index === 0 || reorder.isPending}
                    onClick={() => reorder.mutate(moveItem(resources, index, -1).map((x) => x.id))}
                  >
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="เลื่อนลง"
                    disabled={index === resources.length - 1 || reorder.isPending}
                    onClick={() => reorder.mutate(moveItem(resources, index, 1).map((x) => x.id))}
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="icon" aria-label="ลบสื่อ">
                        <Trash2 aria-hidden />
                      </Button>
                    }
                    title="ลบสื่อนี้?"
                    description="ลบออกจากบทเรียน ไม่สามารถย้อนกลับได้"
                    confirmLabel="ลบ"
                    destructive
                    onConfirm={() => remove.mutate(r.id)}
                  />
                </div>
              </div>
              <ResourceView resource={r} />
            </li>
          ))}
        </ol>
      )}

      <form
        noValidate
        onSubmit={form.handleSubmit((v) => add.mutate(v))}
        className="space-y-3 rounded-lg bg-muted/50 p-4"
      >
        <h3 className="font-medium">เพิ่มสื่อ</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="res-type" label="ประเภท">
            <select {...form.register('type')} id="res-type" className={inputClass}>
              {resourceTypes.map((t) => (
                <option key={t} value={t}>
                  {resourceMeta[t].label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="res-title" label="ชื่อสื่อ (ไม่บังคับ)" error={errors.title?.message}>
            <input
              {...form.register('title')}
              {...fieldA11y('res-title', errors.title?.message)}
              className={inputClass}
            />
          </Field>
        </div>
        {meta.input === 'url' ? (
          <Field id="res-url" label="ลิงก์" hint={meta.hint} error={errors.url?.message}>
            <input
              type="url"
              inputMode="url"
              {...form.register('url')}
              {...fieldA11y('res-url', errors.url?.message, meta.hint)}
              placeholder="https://"
              className={inputClass}
            />
          </Field>
        ) : (
          <Field
            id="res-content"
            label={type === 'code' ? 'โค้ด' : 'ข้อความ'}
            hint={meta.hint}
            error={errors.content?.message}
          >
            <textarea
              {...form.register('content')}
              {...fieldA11y('res-content', errors.content?.message, meta.hint)}
              rows={6}
              className={`${inputClass} py-2 font-mono`}
            />
          </Field>
        )}
        <Button type="submit" variant="secondary" disabled={add.isPending}>
          <Plus aria-hidden />
          เพิ่มสื่อ
        </Button>
      </form>
    </Card>
  );
}

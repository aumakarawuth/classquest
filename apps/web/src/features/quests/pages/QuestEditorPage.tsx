import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { fieldA11y, inputClass } from '@/components/ui/field-utils';
import { getBuilder } from '@/features/learning/api';
import { questStageLabels, questStages } from '@/features/learning/resources';
import { RubricEditor } from '../components/RubricEditor';
import {
  deleteQuest,
  getQuest,
  listCourseQuests,
  questErrorMessage,
  saveQuest,
  type Quest,
} from '../api';
import {
  isoToBangkokLocal,
  questFormSchema,
  questTypeLabels,
  questTypes,
  submitModeLabels,
  submitModes,
  type QuestFormInput,
  type QuestFormValues,
} from '../model';

export default function QuestEditorPage() {
  const { courseId = '', questId } = useParams();
  const isNew = !questId || questId === 'new';
  const quest = useQuery({
    queryKey: ['quests', 'detail', questId],
    queryFn: () => getQuest(questId ?? ''),
    enabled: !isNew,
  });

  const back = (
    <Link
      to={`/teacher/courses/${courseId}/quests`}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden />
      ภารกิจทั้งหมด
    </Link>
  );
  if (!isNew && quest.isPending) return <PageSkeleton />;
  if (!isNew && quest.isError) return <ErrorState onRetry={() => void quest.refetch()} />;
  if (!isNew && !quest.data)
    return (
      <div className="space-y-6">
        {back}
        <EmptyState title="ไม่พบภารกิจ" />
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {back}
      <QuestForm courseId={courseId} quest={isNew ? null : (quest.data ?? null)} />
      {!isNew && quest.data ? (
        <RubricEditor questId={quest.data.id} rubricId={quest.data.rubric_id} />
      ) : (
        <p className="text-sm text-muted-foreground">
          บันทึกภารกิจก่อน แล้วจึงกำหนดเกณฑ์การให้คะแนน (Rubric)
        </p>
      )}
    </div>
  );
}

function defaults(q: Quest | null): QuestFormInput {
  return {
    title: q?.title ?? '',
    type: q?.type ?? 'main',
    unitId: q?.unit_id ?? '',
    questStage: q?.quest_stage ?? '',
    descriptionMd: q?.description_md ?? '',
    objectives: q?.objectives ?? '',
    difficulty: q?.difficulty ?? 1,
    maxScore: q?.max_score ?? 10,
    xpReward: q?.xp_reward ?? 100,
    dueAt: isoToBangkokLocal(q?.due_at ?? null),
    allowLate: q?.allow_late ?? true,
    submitModes: q?.submit_modes ?? ['text', 'url'],
    classroomUrl: q?.classroom_url ?? '',
    maxAttempts: q?.max_attempts ?? 3,
    prerequisiteIds: q?.quest_prerequisites.map((p) => p.required_quest_id) ?? [],
    published: q?.published ?? false,
  };
}

function QuestForm({ courseId, quest }: { courseId: string; quest: Quest | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const units = useQuery({ queryKey: ['builder', courseId], queryFn: () => getBuilder(courseId) });
  const others = useQuery({
    queryKey: ['quests', 'course', courseId],
    queryFn: () => listCourseQuests(courseId),
  });
  const form = useForm<QuestFormInput, unknown, QuestFormValues>({
    resolver: zodResolver(questFormSchema),
    defaultValues: defaults(quest),
  });
  const errors = form.formState.errors;
  const modes = useWatch({ control: form.control, name: 'submitModes' }) ?? [];

  const save = useMutation({
    mutationFn: (v: QuestFormValues) => saveQuest(courseId, quest?.id ?? null, v),
    onSuccess: (id) => {
      toast.success('บันทึกภารกิจแล้ว');
      void queryClient.invalidateQueries({ queryKey: ['quests'] });
      if (!quest) void navigate(`/teacher/courses/${courseId}/quests/${id}`, { replace: true });
    },
    onError: (e) => toast.error(questErrorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => deleteQuest(quest?.id ?? ''),
    onSuccess: () => {
      toast.success('ลบภารกิจแล้ว');
      void queryClient.invalidateQueries({ queryKey: ['quests'] });
      void navigate(`/teacher/courses/${courseId}/quests`);
    },
    onError: (e) => toast.error(questErrorMessage(e)),
  });

  return (
    <Card>
      <form noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{quest ? 'แก้ไขภารกิจ' : 'สร้างภารกิจ'}</h1>
          <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              {...form.register('published')}
              className="size-5 accent-[var(--primary)]"
            />
            เผยแพร่ให้นักเรียนเห็น
          </label>
        </div>

        <Field id="q-title" label="ชื่อภารกิจ" error={errors.title?.message}>
          <input
            {...form.register('title')}
            {...fieldA11y('q-title', errors.title?.message)}
            className={inputClass}
            placeholder="Mission 03: LED Controller"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="q-type" label="ประเภท">
            <select {...form.register('type')} id="q-type" className={inputClass}>
              {questTypes.map((t) => (
                <option key={t} value={t}>
                  {questTypeLabels[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="q-unit" label="หน่วยการเรียนรู้">
            <select {...form.register('unitId')} id="q-unit" className={inputClass}>
              <option value="">ไม่ระบุ</option>
              {units.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.title}
                </option>
              ))}
            </select>
          </Field>
          <Field id="q-stage" label="ขั้นตอน QUEST">
            <select {...form.register('questStage')} id="q-stage" className={inputClass}>
              <option value="">ไม่กำหนด</option>
              {questStages.map((s) => (
                <option key={s} value={s}>
                  {questStageLabels[s]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field id="q-desc" label="รายละเอียดภารกิจ (Markdown)" error={errors.descriptionMd?.message}>
          <textarea
            {...form.register('descriptionMd')}
            id="q-desc"
            rows={8}
            className={`${inputClass} py-2 font-mono`}
          />
        </Field>
        <Field id="q-obj" label="จุดประสงค์การเรียนรู้" error={errors.objectives?.message}>
          <textarea
            {...form.register('objectives')}
            id="q-obj"
            rows={3}
            className={`${inputClass} py-2`}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-4">
          <Field id="q-diff" label="ความยาก (1–5)" error={errors.difficulty?.message}>
            <select {...form.register('difficulty')} id="q-diff" className={inputClass}>
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field id="q-score" label="คะแนนเต็ม" error={errors.maxScore?.message}>
            <input
              type="number"
              step="0.5"
              {...form.register('maxScore')}
              {...fieldA11y('q-score', errors.maxScore?.message)}
              className={inputClass}
            />
          </Field>
          <Field id="q-xp" label="XP ที่ได้รับ" hint="แยกจากคะแนน" error={errors.xpReward?.message}>
            <input
              type="number"
              {...form.register('xpReward')}
              {...fieldA11y('q-xp', errors.xpReward?.message, 'แยกจากคะแนน')}
              className={inputClass}
            />
          </Field>
          <Field id="q-attempts" label="ส่งได้สูงสุด (ครั้ง)" error={errors.maxAttempts?.message}>
            <input
              type="number"
              {...form.register('maxAttempts')}
              {...fieldA11y('q-attempts', errors.maxAttempts?.message)}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="q-due" label="กำหนดส่ง (เวลาไทย)" hint="เว้นว่าง = ไม่มีกำหนด">
            <input
              type="datetime-local"
              {...form.register('dueAt')}
              {...fieldA11y('q-due', undefined, 'เว้นว่าง = ไม่มีกำหนด')}
              className={inputClass}
            />
          </Field>
          <label className="inline-flex min-h-11 items-center gap-2 self-end text-sm">
            <input
              type="checkbox"
              {...form.register('allowLate')}
              className="size-5 accent-[var(--primary)]"
            />
            รับงานหลังกำหนดส่ง (ระบบจะระบุว่าส่งช้า)
          </label>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">วิธีส่งงาน</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {submitModes.map((m) => (
              <label key={m} className="inline-flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  value={m}
                  {...form.register('submitModes')}
                  className="size-5 accent-[var(--primary)]"
                />
                {submitModeLabels[m]}
              </label>
            ))}
          </div>
          {errors.submitModes && (
            <p className="text-xs text-destructive">{errors.submitModes.message}</p>
          )}
        </fieldset>
        {modes.includes('classroom') && (
          <Field
            id="q-classroom"
            label="ลิงก์งานใน Google Classroom"
            hint="นักเรียนจะส่งงานใน Classroom เพื่อไม่ให้ส่งซ้ำซ้อน"
            error={errors.classroomUrl?.message}
          >
            <input
              type="url"
              {...form.register('classroomUrl')}
              {...fieldA11y(
                'q-classroom',
                errors.classroomUrl?.message,
                'นักเรียนจะส่งงานใน Classroom เพื่อไม่ให้ส่งซ้ำซ้อน',
              )}
              className={inputClass}
              placeholder="https://classroom.google.com/c/..."
            />
          </Field>
        )}

        {(others.data?.filter((o) => o.id !== quest?.id).length ?? 0) > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">ต้องผ่านภารกิจเหล่านี้ก่อน</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {others.data
                ?.filter((o) => o.id !== quest?.id)
                .map((o) => (
                  <label key={o.id} className="inline-flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      value={o.id}
                      {...form.register('prerequisiteIds')}
                      className="size-5 accent-[var(--primary)]"
                    />
                    {o.title}
                  </label>
                ))}
            </div>
          </fieldset>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {quest ? (
            <ConfirmDialog
              trigger={
                <Button type="button" variant="outline">
                  <Trash2 aria-hidden />
                  ลบภารกิจ
                </Button>
              }
              title="ลบภารกิจ?"
              description="งานที่นักเรียนส่งมาในภารกิจนี้จะถูกลบด้วย ไม่สามารถย้อนกลับได้"
              confirmLabel="ลบภารกิจ"
              destructive
              onConfirm={() => remove.mutate()}
            />
          ) : (
            <Link
              to={`/teacher/courses/${courseId}/quests`}
              className={buttonVariants({ variant: 'outline' })}
            >
              ยกเลิก
            </Link>
          )}
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'กำลังบันทึก…' : 'บันทึกภารกิจ'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

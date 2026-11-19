import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowLeft, ArrowUp, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { inputClass } from '@/components/ui/field-utils';
import { moveItem } from '@/features/learning/resources';
import { bangkokLocalToIso, isoToBangkokLocal } from '@/features/quests/model';
import {
  deleteQuiz,
  getQuiz,
  getQuizQuestionIds,
  listQuestions,
  quizKindLabels,
  quizKinds,
  saveQuiz,
  setQuizQuestions,
  type Quiz,
  type QuizInput,
  type QuizKind,
} from '../api';

export default function QuizEditorPage() {
  const { courseId = '', quizId = 'new' } = useParams();
  const isNew = quizId === 'new';
  const query = useQuery({
    queryKey: ['quiz-editor', quizId],
    queryFn: async () => {
      const [quiz, ids, bank] = await Promise.all([
        isNew ? Promise.resolve(null) : getQuiz(quizId),
        isNew ? Promise.resolve([]) : getQuizQuestionIds(quizId),
        listQuestions(courseId),
      ]);
      return { quiz, ids, bank };
    },
  });
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        to={`/teacher/courses/${courseId}/quizzes`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        แบบทดสอบ
      </Link>
      {query.isPending ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <Editor
          key={quizId}
          courseId={courseId}
          quiz={query.data.quiz}
          initialIds={query.data.ids}
          bank={query.data.bank}
        />
      )}
    </div>
  );
}

function defaults(q: Quiz | null): QuizInput {
  return {
    unit_id: q?.unit_id ?? null,
    kind: q?.kind ?? 'quiz',
    title: q?.title ?? '',
    description: q?.description ?? '',
    time_limit_minutes: q?.time_limit_minutes ?? null,
    shuffle_questions: q?.shuffle_questions ?? true,
    shuffle_options: q?.shuffle_options ?? true,
    questions_per_attempt: q?.questions_per_attempt ?? null,
    max_attempts: q?.max_attempts ?? 1,
    available_from: q?.available_from ?? null,
    available_until: q?.available_until ?? null,
    answers_visible_at: q?.answers_visible_at ?? null,
    passing_percent: q?.passing_percent ?? 50,
    xp_reward: q?.xp_reward ?? 0,
    published: q?.published ?? false,
  };
}

function Editor({
  courseId,
  quiz,
  initialIds,
  bank,
}: {
  courseId: string;
  quiz: Quiz | null;
  initialIds: string[];
  bank: Awaited<ReturnType<typeof listQuestions>>;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [v, setV] = useState<QuizInput>(defaults(quiz));
  const [ids, setIds] = useState<string[]>(initialIds);
  const set = (patch: Partial<QuizInput>) => setV((p) => ({ ...p, ...patch }));
  const totalPoints = ids.reduce((s, id) => s + (bank.find((b) => b.id === id)?.points ?? 0), 0);
  const error = !v.title.trim()
    ? 'กรุณากรอกชื่อแบบทดสอบ'
    : v.published && ids.length === 0
      ? 'เลือกคำถามอย่างน้อย 1 ข้อก่อนเผยแพร่'
      : v.questions_per_attempt && v.questions_per_attempt > ids.length
        ? 'จำนวนข้อที่สุ่มมากกว่าจำนวนคำถามที่เลือก'
        : v.available_from && v.available_until && v.available_until <= v.available_from
          ? 'เวลาปิดต้องหลังเวลาเปิด'
          : null;

  const save = useMutation({
    mutationFn: async () => {
      const id = await saveQuiz(courseId, quiz?.id ?? null, { ...v, title: v.title.trim() });
      await setQuizQuestions(id, ids);
      return id;
    },
    onSuccess: (id) => {
      toast.success('บันทึกแบบทดสอบแล้ว');
      void queryClient.invalidateQueries({ queryKey: ['quizzes', courseId] });
      if (!quiz) void navigate(`/teacher/courses/${courseId}/quizzes/${id}`, { replace: true });
    },
    onError: () => toast.error('บันทึกไม่สำเร็จ'),
  });
  const remove = useMutation({
    mutationFn: () => deleteQuiz(quiz?.id ?? ''),
    onSuccess: () => {
      toast.success('ลบแบบทดสอบแล้ว');
      void navigate(`/teacher/courses/${courseId}/quizzes`);
    },
    onError: () => toast.error('ลบไม่สำเร็จ'),
  });
  const dt = (key: 'available_from' | 'available_until' | 'answers_visible_at', label: string) => (
    <div className="space-y-1">
      <label htmlFor={`qz-${key}`} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={`qz-${key}`}
        type="datetime-local"
        value={isoToBangkokLocal(v[key])}
        onChange={(e) => set({ [key]: bangkokLocalToIso(e.target.value) })}
        className={inputClass}
      />
    </div>
  );

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!error) save.mutate();
      }}
    >
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold tracking-tight">
            {quiz ? 'แก้ไขแบบทดสอบ' : 'สร้างแบบทดสอบ'}
          </h1>
          <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={v.published}
              onChange={(e) => set({ published: e.target.checked })}
              className="size-5 accent-[var(--primary)]"
            />
            เผยแพร่
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="qz-title" className="block text-sm font-medium">
              ชื่อแบบทดสอบ
            </label>
            <input
              id="qz-title"
              value={v.title}
              maxLength={200}
              onChange={(e) => set({ title: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="qz-kind" className="block text-sm font-medium">
              ประเภท
            </label>
            <select
              id="qz-kind"
              value={v.kind}
              onChange={(e) => set({ kind: e.target.value as QuizKind })}
              className={inputClass}
            >
              {quizKinds.map((k) => (
                <option key={k} value={k}>
                  {quizKindLabels[k]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <label htmlFor="qz-desc" className="block text-sm font-medium">
            คำชี้แจง
          </label>
          <textarea
            id="qz-desc"
            value={v.description}
            maxLength={5000}
            rows={2}
            onChange={(e) => set({ description: e.target.value })}
            className={`${inputClass} py-2`}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <NumberField
            id="qz-time"
            label="เวลา (นาที)"
            value={v.time_limit_minutes}
            placeholder="ไม่จำกัด"
            onChange={(n) => set({ time_limit_minutes: n })}
          />
          <NumberField
            id="qz-per"
            label="สุ่มข้อ (ข้อ)"
            value={v.questions_per_attempt}
            placeholder="ทุกข้อ"
            onChange={(n) => set({ questions_per_attempt: n })}
          />
          <NumberField
            id="qz-attempts"
            label="ทำได้ (ครั้ง)"
            value={v.max_attempts}
            onChange={(n) => set({ max_attempts: n ?? 1 })}
          />
          <NumberField
            id="qz-pass"
            label="เกณฑ์ผ่าน (%)"
            value={v.passing_percent}
            onChange={(n) => set({ passing_percent: n ?? 0 })}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {dt('available_from', 'เปิดให้ทำ (เวลาไทย)')}
          {dt('available_until', 'ปิด (เวลาไทย)')}
          {dt('answers_visible_at', 'แสดงเฉลยเมื่อ (ว่าง = ไม่แสดง)')}
        </div>
        <div className="flex flex-wrap gap-x-6">
          <label className="inline-flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={v.shuffle_questions}
              onChange={(e) => set({ shuffle_questions: e.target.checked })}
              className="size-5 accent-[var(--primary)]"
            />
            สลับลำดับข้อ
          </label>
          <label className="inline-flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={v.shuffle_options}
              onChange={(e) => set({ shuffle_options: e.target.checked })}
              className="size-5 accent-[var(--primary)]"
            />
            สลับตัวเลือก
          </label>
          <NumberField
            id="qz-xp"
            label="XP เมื่อผ่าน"
            value={v.xp_reward}
            onChange={(n) => set({ xp_reward: n ?? 0 })}
          />
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">
          คำถามในแบบทดสอบ ({ids.length} ข้อ, {totalPoints} คะแนน)
        </h2>
        {ids.length > 0 && (
          <ol className="space-y-2">
            {ids.map((id, i) => {
              const q = bank.find((b) => b.id === id);
              return (
                <li key={id} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                  <span className="w-6 text-center tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{q?.stem ?? '—'}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`เลื่อนข้อ ${i + 1} ขึ้น`}
                    disabled={i === 0}
                    onClick={() => setIds(moveItem(ids, i, -1))}
                  >
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`เลื่อนข้อ ${i + 1} ลง`}
                    disabled={i === ids.length - 1}
                    onClick={() => setIds(moveItem(ids, i, 1))}
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`นำข้อ ${i + 1} ออก`}
                    onClick={() => setIds(ids.filter((x) => x !== id))}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              );
            })}
          </ol>
        )}
        <details>
          <summary className="cursor-pointer text-sm font-medium">
            เพิ่มจากคลังข้อสอบ ({bank.filter((b) => !ids.includes(b.id)).length} ข้อ)
          </summary>
          <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto">
            {bank
              .filter((b) => !ids.includes(b.id))
              .map((b) => (
                <li key={b.id}>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto w-full justify-start py-2 text-left whitespace-normal"
                    onClick={() => setIds([...ids, b.id])}
                  >
                    + {b.stem}
                    {b.bank_tag && (
                      <span className="text-xs text-muted-foreground"> · {b.bank_tag}</span>
                    )}
                  </Button>
                </li>
              ))}
          </ul>
          <Link
            to={`/teacher/courses/${courseId}/question-bank`}
            className="mt-2 inline-block text-sm text-primary underline"
          >
            ไปที่คลังข้อสอบเพื่อสร้างคำถามใหม่
          </Link>
        </details>
      </Card>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        {quiz ? (
          <ConfirmDialog
            trigger={
              <Button type="button" variant="outline">
                <Trash2 aria-hidden />
                ลบแบบทดสอบ
              </Button>
            }
            title="ลบแบบทดสอบ?"
            description="ผลการทำแบบทดสอบของนักเรียนจะถูกลบด้วย"
            confirmLabel="ลบ"
            destructive
            onConfirm={() => remove.mutate()}
          />
        ) : (
          <span />
        )}
        {quiz && (
          <Link
            to={`/teacher/courses/${courseId}/quizzes/${quiz.id}/results`}
            className="text-sm text-primary underline"
          >
            ดูผลและตรวจข้อเขียน
          </Link>
        )}
        <Button type="submit" disabled={!!error || save.isPending}>
          {save.isPending ? 'กำลังบันทึก…' : 'บันทึกแบบทดสอบ'}
        </Button>
      </div>
    </form>
  );
}

function NumberField({
  id,
  label,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: number | null;
  placeholder?: string;
  onChange: (n: number | null) => void;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={0}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className={inputClass}
      />
    </div>
  );
}

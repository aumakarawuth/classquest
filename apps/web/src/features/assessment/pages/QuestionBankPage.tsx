import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { inputClass } from '@/components/ui/field-utils';
import { listCompetencies } from '@/features/competency/api';
import {
  deleteQuestion,
  listQuestions,
  questionTypeLabels,
  saveQuestion,
  type Question,
  type QuestionInput,
} from '../api';
import { QuestionEditor } from '../components/QuestionEditor';
import { emptyQuestion, questionErrorMessage, toInput } from '../questionUtils';

export default function QuestionBankPage() {
  const { courseId = '' } = useParams();
  const queryClient = useQueryClient();
  const questions = useQuery({
    queryKey: ['questions', courseId],
    queryFn: () => listQuestions(courseId),
  });
  const competencies = useQuery({
    queryKey: ['competency', 'list', courseId],
    queryFn: () => listCompetencies(courseId),
  });
  const [editing, setEditing] = useState<Question | 'new' | null>(null);
  const [tag, setTag] = useState('');

  const save = useMutation({
    mutationFn: (q: QuestionInput) =>
      saveQuestion(courseId, editing && editing !== 'new' ? editing.id : null, q),
    onSuccess: () => {
      toast.success('บันทึกคำถามแล้ว');
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ['questions', courseId] });
    },
    onError: (e) => toast.error(questionErrorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: deleteQuestion,
    onSuccess: () => {
      toast.success('ลบคำถามแล้ว');
      void queryClient.invalidateQueries({ queryKey: ['questions', courseId] });
    },
    onError: (e) => toast.error(questionErrorMessage(e)),
  });

  const tags = [...new Set(questions.data?.map((q) => q.bank_tag).filter(Boolean))].sort();
  const visible = questions.data?.filter((q) => !tag || q.bank_tag === tag) ?? [];

  return (
    <div className="space-y-6">
      <Link
        to={`/teacher/courses/${courseId}/quizzes`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        แบบทดสอบ
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">คลังข้อสอบ</h1>
          <p className="text-sm text-muted-foreground">นักเรียนไม่สามารถเข้าถึงคลังข้อสอบและเฉลยได้</p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus aria-hidden />
          เพิ่มคำถาม
        </Button>
      </div>
      {editing && (
        <Card>
          <QuestionEditor
            key={editing === 'new' ? 'new' : editing.id}
            initial={editing === 'new' ? emptyQuestion() : toInput(editing)}
            competencies={competencies.data ?? []}
            saving={save.isPending}
            onSave={(q) => save.mutate(q)}
            onCancel={() => setEditing(null)}
          />
        </Card>
      )}
      {tags.length > 0 && (
        <div className="flex items-center gap-2">
          <label htmlFor="qb-tag" className="text-sm">
            หมวด
          </label>
          <select
            id="qb-tag"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className={`${inputClass} max-w-60`}
          >
            <option value="">ทั้งหมด</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      )}
      {questions.isPending ? (
        <PageSkeleton />
      ) : questions.isError ? (
        <ErrorState onRetry={() => void questions.refetch()} />
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีคำถาม</p>
      ) : (
        <ol className="space-y-2">
          {visible.map((q, i) => (
            <li key={q.id}>
              <Card className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {i + 1}. {questionTypeLabels[q.type]} · {q.points} คะแนน
                    {q.bank_tag && ` · ${q.bank_tag}`}
                  </p>
                  <p className="whitespace-pre-line">{q.stem}</p>
                  {q.type !== 'short' && (
                    <ul className="text-sm text-muted-foreground">
                      {q.question_options.map((o) => (
                        <li key={o.id}>
                          {o.is_correct ? '✓ ' : '· '}
                          {o.label}
                          {o.is_correct && <span className="sr-only"> (คำตอบที่ถูก)</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`แก้ไขคำถาม ${i + 1}`}
                    onClick={() => setEditing(q)}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="icon" aria-label={`ลบคำถาม ${i + 1}`}>
                        <Trash2 aria-hidden />
                      </Button>
                    }
                    title="ลบคำถาม?"
                    description="ลบได้เฉพาะคำถามที่ยังไม่ถูกใช้ในแบบทดสอบ"
                    confirmLabel="ลบ"
                    destructive
                    onConfirm={() => remove.mutate(q.id)}
                  />
                </div>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { inputClass } from '@/components/ui/field-utils';
import { getSurvey, submitSurvey } from '../api';

const scale = [
  { v: 5, label: 'มากที่สุด' },
  { v: 4, label: 'มาก' },
  { v: 3, label: 'ปานกลาง' },
  { v: 2, label: 'น้อย' },
  { v: 1, label: 'น้อยที่สุด' },
];

export default function SurveyPage() {
  const { surveyId = '' } = useParams();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['survey', surveyId], queryFn: () => getSurvey(surveyId) });
  const [answers, setAnswers] = useState<Record<string, number | string>>({});
  const submit = useMutation({
    mutationFn: () =>
      submitSurvey(
        surveyId,
        Object.fromEntries(Object.entries(answers).filter(([, v]) => v !== '')),
      ),
    onSuccess: () => {
      toast.success('ขอบคุณสำหรับความคิดเห็น');
      void navigate(q.data ? `/student/courses/${q.data.course_id}` : '/student');
    },
    onError: () => toast.error('ส่งไม่สำเร็จ'),
  });
  if (q.isPending) return <PageSkeleton />;
  if (!q.data || !q.data.open) return <EmptyState title="แบบประเมินนี้ปิดแล้ว" />;
  const s = q.data;
  const likert = s.items.filter((i) => i.type === 'likert');
  const complete = likert.every((i) => typeof answers[i.id] === 'number');
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">{s.title}</h1>
      <p className="text-sm text-muted-foreground">
        {s.anonymous ? 'แบบประเมินนี้ไม่ระบุตัวตน ครูเห็นเฉพาะผลรวมของทั้งห้อง' : 'แบบประเมินนี้ระบุตัวตน'}
      </p>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (complete) submit.mutate();
        }}
      >
        {s.items.map((it, n) => (
          <Card key={it.id}>
            {it.type === 'likert' ? (
              <fieldset className="space-y-2">
                <legend className="font-medium">
                  {n + 1}. {it.text}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {scale.map((o) => (
                    <label
                      key={o.v}
                      className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm has-checked:border-primary has-checked:bg-primary/5"
                    >
                      <input
                        type="radio"
                        name={it.id}
                        checked={answers[it.id] === o.v}
                        onChange={() => setAnswers({ ...answers, [it.id]: o.v })}
                        className="accent-[var(--primary)]"
                      />
                      {o.v} {o.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <>
                <label htmlFor={`sv-${it.id}`} className="block font-medium">
                  {n + 1}. {it.text}
                </label>
                <textarea
                  id={`sv-${it.id}`}
                  rows={3}
                  maxLength={2000}
                  value={(answers[it.id] as string) ?? ''}
                  onChange={(e) => setAnswers({ ...answers, [it.id]: e.target.value })}
                  className={`${inputClass} mt-2 py-2`}
                />
              </>
            )}
          </Card>
        ))}
        <Button type="submit" disabled={!complete || submit.isPending}>
          ส่งแบบประเมิน
        </Button>
      </form>
    </div>
  );
}

import { useMutation } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { inputClass } from '@/components/ui/field-utils';
import { cn } from '@/lib/utils';
import {
  attemptErrorMessage,
  formatClock,
  secondsLeft,
  submitAttempt,
  type AnswerInput,
  type AttemptPayload,
} from '../attemptApi';

const draftKey = (attemptId: string) => `classquest.quiz-draft.${attemptId}`;

export default function TakeQuizPage() {
  const { attemptId = '' } = useParams();
  const location = useLocation();
  const fromState = location.state as AttemptPayload | null;
  // The payload comes from start_quiz_attempt via navigation state. After a reload the student
  // goes back and presses "ทำต่อ"; the server returns the same in-progress attempt.
  if (!fromState || fromState.attempt_id !== attemptId) return <ResumeHint />;
  return <Taking payload={fromState} />;
}

function ResumeHint() {
  return (
    <div className="mx-auto max-w-xl py-10">
      <ErrorState
        title="ไม่พบข้อมูลการทำแบบทดสอบ"
        description="กลับไปที่หน้าแบบทดสอบแล้วกด “ทำต่อ” — คำตอบที่บันทึกไว้ในเครื่องจะยังอยู่"
      />
    </div>
  );
}

function Taking({ payload }: { payload: AttemptPayload }) {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<string, AnswerInput>>(() => {
    try {
      return JSON.parse(localStorage.getItem(draftKey(payload.attempt_id)) ?? '{}') as Record<
        string,
        AnswerInput
      >;
    } catch {
      return {};
    }
  });
  const [now, setNow] = useState(() => Date.now());
  const autoSubmitted = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey(payload.attempt_id), JSON.stringify(answers));
    } catch {
      /* private mode: answers stay in memory */
    }
  }, [answers, payload.attempt_id]);

  const left = secondsLeft(payload.deadline_at, now);
  useEffect(() => {
    if (!payload.deadline_at) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [payload.deadline_at]);

  const submit = useMutation({
    mutationFn: () => submitAttempt(payload.attempt_id, Object.values(answers)),
    onSuccess: () => {
      try {
        localStorage.removeItem(draftKey(payload.attempt_id));
      } catch {
        /* ignore */
      }
      toast.success('ส่งคำตอบแล้ว');
      void navigate(`/student/attempts/${payload.attempt_id}/result`, { replace: true });
    },
    onError: (e) => toast.error(attemptErrorMessage(e)),
  });

  useEffect(() => {
    if (left === 0 && !autoSubmitted.current && !submit.isPending) {
      autoSubmitted.current = true;
      submit.mutate();
    }
  }, [left, submit]);

  const answered = payload.questions.filter(
    (q) => answers[q.id]?.option_id || answers[q.id]?.text?.trim(),
  ).length;

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-24">
      <div className="sticky top-16 z-20 flex items-center justify-between gap-3 rounded-lg border bg-card/95 p-3 backdrop-blur">
        <span className="text-sm">
          ตอบแล้ว {answered}/{payload.questions.length} ข้อ
        </span>
        {left !== null && (
          <span
            role="timer"
            aria-live={left <= 60 ? 'assertive' : 'off'}
            className={cn(
              'inline-flex items-center gap-1 font-semibold tabular-nums',
              left <= 60 && 'text-destructive',
            )}
          >
            <Clock className="size-4" aria-hidden />
            <span className="sr-only">เวลาที่เหลือ</span>
            {formatClock(left)}
          </span>
        )}
      </div>
      <h1 className="sr-only">ทำแบบทดสอบ</h1>
      <ol className="space-y-4">
        {payload.questions.map((q, i) => (
          <li key={q.id}>
            <Card>
              <fieldset className="space-y-3">
                <legend className="font-medium">
                  <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                  <span className="whitespace-pre-line">{q.stem}</span>
                  <span className="ml-2 text-xs text-muted-foreground">({q.points} คะแนน)</span>
                </legend>
                {q.type === 'short' ? (
                  <>
                    <label htmlFor={`ans-${q.id}`} className="sr-only">
                      คำตอบข้อ {i + 1}
                    </label>
                    <textarea
                      id={`ans-${q.id}`}
                      rows={2}
                      maxLength={2000}
                      value={answers[q.id]?.text ?? ''}
                      className={`${inputClass} py-2`}
                      onChange={(e) =>
                        setAnswers((p) => ({
                          ...p,
                          [q.id]: { question_id: q.id, text: e.target.value },
                        }))
                      }
                    />
                  </>
                ) : (
                  <div className="space-y-2">
                    {q.options.map((o) => (
                      <label
                        key={o.id}
                        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 has-checked:border-primary has-checked:bg-primary/5"
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={o.id}
                          checked={answers[q.id]?.option_id === o.id}
                          className="size-5 accent-[var(--primary)]"
                          onChange={() =>
                            setAnswers((p) => ({
                              ...p,
                              [q.id]: { question_id: q.id, option_id: o.id },
                            }))
                          }
                        />
                        <span>{o.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
            </Card>
          </li>
        ))}
      </ol>
      <div className="flex justify-end">
        <ConfirmDialog
          trigger={
            <Button disabled={submit.isPending}>{submit.isPending ? 'กำลังส่ง…' : 'ส่งคำตอบ'}</Button>
          }
          title="ส่งคำตอบ?"
          description={
            answered < payload.questions.length
              ? `ยังไม่ได้ตอบ ${payload.questions.length - answered} ข้อ ส่งแล้วแก้ไขไม่ได้`
              : 'ส่งแล้วแก้ไขไม่ได้'
          }
          confirmLabel="ส่งคำตอบ"
          onConfirm={() => submit.mutate()}
        />
      </div>
    </div>
  );
}

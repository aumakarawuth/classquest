import { z } from 'zod';
import { supabase } from '@/lib/supabase';

function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

const payloadSchema = z.object({
  attempt_id: z.string(),
  quiz_id: z.string(),
  deadline_at: z.string().nullable(),
  status: z.enum(['in_progress', 'submitted', 'graded']),
  questions: z.array(
    z.object({
      id: z.string(),
      type: z.enum(['mc', 'tf', 'short']),
      stem: z.string(),
      points: z.coerce.number(),
      options: z.array(z.object({ id: z.string(), label: z.string() })),
    }),
  ),
});
export type AttemptPayload = z.infer<typeof payloadSchema>;

/** Starts or resumes an attempt. The payload never contains correct answers. */
export async function startAttempt(quizId: string): Promise<AttemptPayload> {
  const { data, error } = await client().rpc('start_quiz_attempt', { _quiz_id: quizId });
  if (error) throw error;
  return payloadSchema.parse(data);
}

export type AnswerInput = { question_id: string; option_id?: string; text?: string };

export async function submitAttempt(attemptId: string, answers: AnswerInput[]) {
  const { data, error } = await client().rpc('submit_quiz_attempt', {
    _attempt_id: attemptId,
    _answers: answers,
  });
  if (error) throw error;
  return z
    .object({
      status: z.string(),
      score: z.coerce.number().nullable(),
      max_score: z.coerce.number().nullable(),
    })
    .parse(data);
}

const resultSchema = z.object({
  attempt_id: z.string(),
  quiz_id: z.string(),
  status: z.enum(['in_progress', 'submitted', 'graded']),
  score: z.coerce.number().nullable(),
  max_score: z.coerce.number().nullable(),
  passing_percent: z.coerce.number(),
  submitted_at: z.string().nullable(),
  answers_revealed: z.boolean(),
  answers_visible_at: z.string().nullable(),
  questions: z.array(
    z.object({
      id: z.string(),
      type: z.enum(['mc', 'tf', 'short']),
      stem: z.string(),
      points: z.coerce.number(),
      explanation: z.string(),
      answer_id: z.string().nullable(),
      my_option_id: z.string().nullable(),
      my_text: z.string().nullable(),
      is_correct: z.boolean().nullable(),
      earned: z.coerce.number().nullable(),
      feedback: z.string().nullable(),
      options: z.array(z.object({ id: z.string(), label: z.string(), is_correct: z.boolean() })),
    }),
  ),
});
export type AttemptResult = z.infer<typeof resultSchema>;

export async function getAttemptResult(attemptId: string): Promise<AttemptResult> {
  const { data, error } = await client().rpc('get_attempt_result', { _attempt_id: attemptId });
  if (error) throw error;
  return resultSchema.parse(data);
}

const attemptRowSchema = z.object({
  id: z.string(),
  quiz_id: z.string(),
  user_id: z.string(),
  attempt_no: z.number(),
  status: z.enum(['in_progress', 'submitted', 'graded']),
  started_at: z.string(),
  submitted_at: z.string().nullable(),
  score: z.coerce.number().nullable(),
  max_score: z.coerce.number().nullable(),
});
export type AttemptRow = z.infer<typeof attemptRowSchema>;

export async function listMyAttempts(userId: string, quizIds: string[]): Promise<AttemptRow[]> {
  if (!quizIds.length) return [];
  const { data, error } = await client()
    .from('quiz_attempts')
    .select('id, quiz_id, user_id, attempt_no, status, started_at, submitted_at, score, max_score')
    .eq('user_id', userId)
    .in('quiz_id', quizIds)
    .order('attempt_no', { ascending: false });
  if (error) throw error;
  return z.array(attemptRowSchema).parse(data);
}

export async function listQuizAttempts(quizId: string) {
  const { data, error } = await client()
    .from('quiz_attempts')
    .select(
      'id, quiz_id, user_id, attempt_no, status, started_at, submitted_at, score, max_score, profiles!quiz_attempts_user_id_fkey(display_name)',
    )
    .eq('quiz_id', quizId)
    .neq('status', 'in_progress')
    .order('submitted_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return z
    .array(attemptRowSchema.extend({ profiles: z.object({ display_name: z.string() }) }))
    .parse(data);
}

export async function gradeAnswer(answerId: string, points: number, feedback: string) {
  const { error } = await client().rpc('grade_quiz_answer', {
    _answer_id: answerId,
    _points: points,
    _feedback: feedback,
  });
  if (error) throw error;
}

export function attemptErrorMessage(e: unknown): string {
  const message = (e as { message?: string } | null)?.message ?? '';
  const map: [string, string][] = [
    ['CQ_NOT_AVAILABLE', 'แบบทดสอบยังไม่เปิดหรือปิดไปแล้ว'],
    ['CQ_NO_ATTEMPTS_LEFT', 'ทำแบบทดสอบครบจำนวนครั้งแล้ว'],
    ['CQ_NO_QUESTIONS', 'แบบทดสอบนี้ยังไม่มีคำถาม'],
    ['CQ_ALREADY_SUBMITTED', 'ส่งคำตอบไปแล้ว'],
    ['CQ_SCORE_OUT_OF_RANGE', 'คะแนนเกินคะแนนเต็มของข้อ'],
    ['CQ_FORBIDDEN', 'คุณไม่มีสิทธิ์ทำรายการนี้'],
  ];
  return map.find(([c]) => message.includes(c))?.[1] ?? 'ทำรายการไม่สำเร็จ กรุณาลองใหม่';
}

/** Remaining whole seconds until the deadline (never negative). */
export function secondsLeft(deadline: string | null, now: number): number | null {
  if (!deadline) return null;
  return Math.max(0, Math.floor((new Date(deadline).getTime() - now) / 1000));
}
export function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

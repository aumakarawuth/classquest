import { z } from 'zod';
import { supabase } from '@/lib/supabase';

function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

export const quizKinds = ['pretest', 'posttest', 'quiz', 'practical'] as const;
export type QuizKind = (typeof quizKinds)[number];
export const quizKindLabels: Record<QuizKind, string> = {
  pretest: 'แบบทดสอบก่อนเรียน (Pre-test)',
  posttest: 'แบบทดสอบหลังเรียน (Post-test)',
  quiz: 'แบบทดสอบย่อย (Quiz)',
  practical: 'การประเมินภาคปฏิบัติ',
};
export const questionTypes = ['mc', 'tf', 'short'] as const;
export type QuestionType = (typeof questionTypes)[number];
export const questionTypeLabels: Record<QuestionType, string> = {
  mc: 'ปรนัย (เลือกตอบ)',
  tf: 'ถูก/ผิด',
  short: 'เติมคำตอบสั้น',
};

const quizSchema = z.object({
  id: z.string(),
  course_id: z.string(),
  unit_id: z.string().nullable(),
  kind: z.enum(quizKinds),
  title: z.string(),
  description: z.string(),
  time_limit_minutes: z.number().nullable(),
  shuffle_questions: z.boolean(),
  shuffle_options: z.boolean(),
  questions_per_attempt: z.number().nullable(),
  max_attempts: z.number(),
  available_from: z.string().nullable(),
  available_until: z.string().nullable(),
  answers_visible_at: z.string().nullable(),
  passing_percent: z.coerce.number(),
  xp_reward: z.number(),
  published: z.boolean(),
});
export type Quiz = z.infer<typeof quizSchema>;
export type QuizInput = Omit<Quiz, 'id' | 'course_id'>;

const QUIZ_COLUMNS =
  'id, course_id, unit_id, kind, title, description, time_limit_minutes, shuffle_questions, shuffle_options, questions_per_attempt, max_attempts, available_from, available_until, answers_visible_at, passing_percent, xp_reward, published';

export async function listQuizzes(courseId: string): Promise<Quiz[]> {
  const { data, error } = await client()
    .from('quizzes')
    .select(QUIZ_COLUMNS)
    .eq('course_id', courseId)
    .order('created_at');
  if (error) throw error;
  return z.array(quizSchema).parse(data);
}

export async function getQuiz(id: string): Promise<Quiz | null> {
  const { data, error } = await client()
    .from('quizzes')
    .select(QUIZ_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? quizSchema.parse(data) : null;
}

export async function saveQuiz(
  courseId: string,
  id: string | null,
  input: QuizInput,
): Promise<string> {
  if (id) {
    const { error } = await client().from('quizzes').update(input).eq('id', id);
    if (error) throw error;
    return id;
  }
  const { data, error } = await client()
    .from('quizzes')
    .insert({ ...input, course_id: courseId })
    .select('id')
    .single();
  if (error) throw error;
  return z.object({ id: z.string() }).parse(data).id;
}

export async function deleteQuiz(id: string) {
  const { error } = await client().from('quizzes').delete().eq('id', id);
  if (error) throw error;
}

const optionSchema = z.object({
  id: z.string(),
  position: z.number(),
  label: z.string(),
  is_correct: z.boolean(),
});
const questionSchema = z.object({
  id: z.string(),
  type: z.enum(questionTypes),
  stem: z.string(),
  explanation: z.string(),
  points: z.coerce.number(),
  competency_id: z.string().nullable(),
  bank_tag: z.string(),
  question_options: z.array(optionSchema),
});
export type Question = z.infer<typeof questionSchema>;

export async function listQuestions(courseId: string): Promise<Question[]> {
  const { data, error } = await client()
    .from('questions')
    .select(
      'id, type, stem, explanation, points, competency_id, bank_tag, question_options(id, position, label, is_correct)',
    )
    .eq('course_id', courseId)
    .order('created_at')
    .order('position', { referencedTable: 'question_options' })
    .limit(1000);
  if (error) throw error;
  return z.array(questionSchema).parse(data);
}

export interface QuestionInput {
  type: QuestionType;
  stem: string;
  explanation: string;
  points: number;
  competency_id: string | null;
  bank_tag: string;
  options: { label: string; is_correct: boolean }[];
}

export async function saveQuestion(
  courseId: string,
  id: string | null,
  q: QuestionInput,
): Promise<string> {
  const { data, error } = await client().rpc('save_question', {
    _question_id: id,
    _course_id: courseId,
    _q: q,
  });
  if (error) throw error;
  return z.string().parse(data);
}

export async function deleteQuestion(id: string) {
  const { error } = await client().from('questions').delete().eq('id', id);
  if (error) throw error;
}

export async function getQuizQuestionIds(quizId: string): Promise<string[]> {
  const { data, error } = await client()
    .from('quiz_questions')
    .select('question_id, position')
    .eq('quiz_id', quizId)
    .order('position');
  if (error) throw error;
  return z
    .array(z.object({ question_id: z.string() }).passthrough())
    .parse(data)
    .map((r) => r.question_id);
}

export async function setQuizQuestions(quizId: string, ids: string[]) {
  const { error } = await client().rpc('set_quiz_questions', {
    _quiz_id: quizId,
    _question_ids: ids,
  });
  if (error) throw error;
}

/** Mirrors the server rules in save_question(); returns a Thai message or null. */
export function validateQuestion(q: QuestionInput): string | null {
  if (!q.stem.trim()) return 'กรุณากรอกคำถาม';
  if (!(q.points > 0)) return 'คะแนนต้องมากกว่า 0';
  if (q.options.some((o) => !o.label.trim())) return 'ตัวเลือก/คำตอบต้องไม่ว่าง';
  const correct = q.options.filter((o) => o.is_correct).length;
  if (q.type === 'mc' && (q.options.length < 2 || q.options.length > 8))
    return 'ปรนัยต้องมี 2–8 ตัวเลือก';
  if (q.type === 'mc' && correct !== 1) return 'เลือกคำตอบที่ถูกต้อง 1 ข้อ';
  if (q.type === 'tf' && correct !== 1) return 'เลือกว่าข้อความนี้ถูกหรือผิด';
  if (q.type === 'short' && q.options.length > 10) return 'คำตอบที่ยอมรับได้ไม่เกิน 10 แบบ';
  return null;
}

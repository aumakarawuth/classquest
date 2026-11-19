import { z } from 'zod';
import { supabase } from '@/lib/supabase';

function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

const criterionSchema = z.object({
  id: z.string(),
  position: z.number(),
  name: z.string(),
  description: z.string(),
  max_points: z.coerce.number(),
});
export type RubricCriterion = z.infer<typeof criterionSchema>;

export async function getRubricCriteria(rubricId: string): Promise<RubricCriterion[]> {
  const { data, error } = await client()
    .from('rubric_criteria')
    .select('id, position, name, description, max_points')
    .eq('rubric_id', rubricId)
    .order('position');
  if (error) throw error;
  return z.array(criterionSchema).parse(data);
}

export interface CriterionInput {
  name: string;
  description: string;
  max_points: number;
}
export async function saveQuestRubric(questId: string, criteria: CriterionInput[]) {
  const { error } = await client().rpc('save_quest_rubric', {
    _quest_id: questId,
    _criteria: criteria,
  });
  if (error) throw error;
}

const reviewSchema = z.object({
  id: z.string(),
  submission_id: z.string(),
  decision: z.enum(['approved', 'needs_revision']),
  score: z.coerce.number().nullable(),
  feedback: z.string(),
  created_at: z.string(),
});
export type Review = z.infer<typeof reviewSchema>;

/** Reviews of the given submissions (students see only their own via RLS). */
export async function listReviews(submissionIds: string[]): Promise<Review[]> {
  if (!submissionIds.length) return [];
  const { data, error } = await client()
    .from('quest_reviews')
    .select('id, submission_id, decision, score, feedback, created_at')
    .in('submission_id', submissionIds);
  if (error) throw error;
  return z.array(reviewSchema).parse(data);
}

const queueSchema = z.object({
  id: z.string(),
  attempt_no: z.number(),
  is_late: z.boolean(),
  submitted_at: z.string(),
  profiles: z.object({ display_name: z.string() }),
  quests: z.object({ id: z.string(), title: z.string(), type: z.string() }),
  courses: z.object({ id: z.string(), code: z.string(), name: z.string() }),
});
export type QueueItem = z.infer<typeof queueSchema>;

/** Submissions waiting for review in courses the teacher teaches (RLS), oldest first. */
export async function listReviewQueue(): Promise<QueueItem[]> {
  const { data, error } = await client()
    .from('quest_submissions')
    .select(
      'id, attempt_no, is_late, submitted_at, profiles!quest_submissions_user_id_fkey(display_name), quests!inner(id, title, type), courses!inner(id, code, name)',
    )
    .eq('status', 'submitted')
    .order('submitted_at')
    .limit(200);
  if (error) throw error;
  return z.array(queueSchema).parse(data);
}

const detailSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  quest_id: z.string(),
  attempt_no: z.number(),
  content_text: z.string().nullable(),
  url: z.string().nullable(),
  storage_path: z.string().nullable(),
  status: z.enum(['submitted', 'needs_revision', 'approved']),
  is_late: z.boolean(),
  submitted_at: z.string(),
  profiles: z.object({ display_name: z.string() }),
  quests: z.object({
    id: z.string(),
    course_id: z.string(),
    title: z.string(),
    description_md: z.string(),
    max_score: z.coerce.number(),
    xp_reward: z.number(),
    rubric_id: z.string().nullable(),
  }),
});
export type ReviewSubmission = z.infer<typeof detailSchema>;

const historySchema = z.object({
  id: z.string(),
  attempt_no: z.number(),
  content_text: z.string().nullable(),
  url: z.string().nullable(),
  storage_path: z.string().nullable(),
  status: z.enum(['submitted', 'needs_revision', 'approved']),
  submitted_at: z.string(),
});

export async function getReviewSubmission(submissionId: string) {
  const { data, error } = await client()
    .from('quest_submissions')
    .select(
      'id, user_id, quest_id, attempt_no, content_text, url, storage_path, status, is_late, submitted_at, profiles!quest_submissions_user_id_fkey(display_name), quests!inner(id, course_id, title, description_md, max_score, xp_reward, rubric_id)',
    )
    .eq('id', submissionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const submission = detailSchema.parse(data);

  const [history, criteria] = await Promise.all([
    client()
      .from('quest_submissions')
      .select('id, attempt_no, content_text, url, storage_path, status, submitted_at')
      .eq('quest_id', submission.quest_id)
      .eq('user_id', submission.user_id)
      .lt('attempt_no', submission.attempt_no)
      .order('attempt_no', { ascending: false }),
    submission.quests.rubric_id
      ? getRubricCriteria(submission.quests.rubric_id)
      : Promise.resolve([]),
  ]);
  if (history.error) throw history.error;
  const previous = z.array(historySchema).parse(history.data);
  const reviews = await listReviews(previous.map((p) => p.id));
  return { submission, previous, reviews, criteria };
}

export interface ReviewInput {
  submissionId: string;
  decision: 'approved' | 'needs_revision';
  score: number | null;
  feedback: string;
  rubric: { criterion_id: string; points: number }[] | null;
  idempotencyKey: string;
}

export async function reviewSubmission(input: ReviewInput) {
  const { error } = await client().rpc('review_submission', {
    _submission_id: input.submissionId,
    _decision: input.decision,
    _score: input.score,
    _feedback: input.feedback,
    _rubric: input.rubric,
    _idempotency_key: input.idempotencyKey,
  });
  if (error) throw error;
}

export function reviewErrorMessage(error: unknown): string {
  const message = (error as { message?: string } | null)?.message ?? '';
  const map: [string, string][] = [
    ['CQ_ALREADY_REVIEWED', 'งานนี้ถูกตรวจแล้ว'],
    ['CQ_INVALID_RUBRIC', 'กรุณาให้คะแนนครบทุกเกณฑ์และไม่เกินคะแนนเต็มของเกณฑ์'],
    ['CQ_SCORE_REQUIRED', 'กรุณาให้คะแนนก่อนอนุมัติ'],
    ['CQ_SCORE_OUT_OF_RANGE', 'คะแนนต้องอยู่ระหว่าง 0 ถึงคะแนนเต็ม'],
    ['CQ_FORBIDDEN', 'คุณไม่มีสิทธิ์ตรวจงานนี้'],
  ];
  return map.find(([code]) => message.includes(code))?.[1] ?? 'บันทึกไม่สำเร็จ กรุณาลองใหม่';
}

import { z } from 'zod';
import { supabase } from '@/lib/supabase';

function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

const memberSchema = z.object({
  user_id: z.string(),
  created_at: z.string(),
  profiles: z.object({
    display_name: z.string(),
    email: z.string(),
    student_code: z.string().nullable(),
  }),
});
export interface RosterStudent {
  id: string;
  name: string;
  email: string;
  studentCode: string | null;
  joinedAt: string;
}

/** Students enrolled in a course (RLS: course teachers and admins only). */
export async function listRoster(courseId: string): Promise<RosterStudent[]> {
  const { data, error } = await client()
    .from('course_members')
    .select(
      'user_id, created_at, profiles!course_members_user_id_fkey(display_name, email, student_code)',
    )
    .eq('course_id', courseId)
    .eq('member_role', 'student')
    .limit(500);
  if (error) throw error;
  return z
    .array(memberSchema)
    .parse(data)
    .map((r) => ({
      id: r.user_id,
      name: r.profiles.display_name,
      email: r.profiles.email,
      studentCode: r.profiles.student_code,
      joinedAt: r.created_at,
    }))
    .sort((a, b) => (a.studentCode ?? a.name).localeCompare(b.studentCode ?? b.name, 'th'));
}

/** Removes the enrollment only; the student's past work and XP history stay in the database. */
export async function removeFromCourse(courseId: string, userId: string): Promise<void> {
  const { error } = await client()
    .from('course_members')
    .delete()
    .eq('course_id', courseId)
    .eq('user_id', userId)
    .eq('member_role', 'student');
  if (error) throw error;
}

const reviewSchema = z.object({
  score: z.coerce.number().nullable(),
  decision: z.string(),
  quest_submissions: z.object({
    quest_id: z.string(),
    user_id: z.string(),
    attempt_no: z.number(),
  }),
});
const attemptSchema = z.object({
  quiz_id: z.string(),
  user_id: z.string(),
  attempt_no: z.number(),
  score: z.coerce.number().nullable(),
  max_score: z.coerce.number().nullable(),
});

export interface GradeCell {
  score: number | null;
  max: number | null;
  status: string;
}
/** key = `${itemId}:${userId}` */
export type GradeMap = Map<string, GradeCell>;

/** Latest reviewed quest score and latest submitted quiz score per student — as stored, nothing recomputed. */
export async function getGrades(
  courseId: string,
  questMax: Map<string, number>,
): Promise<GradeMap> {
  const [reviews, attempts] = await Promise.all([
    client()
      .from('quest_reviews')
      .select('score, decision, quest_submissions!inner(quest_id, user_id, attempt_no)')
      .eq('course_id', courseId)
      .limit(5000),
    client()
      .from('quiz_attempts')
      .select('quiz_id, user_id, attempt_no, score, max_score')
      .eq('course_id', courseId)
      .in('status', ['submitted', 'graded'])
      .limit(5000),
  ]);
  if (reviews.error) throw reviews.error;
  if (attempts.error) throw attempts.error;
  const map: GradeMap = new Map();
  const seen = new Map<string, number>();
  for (const r of z.array(reviewSchema).parse(reviews.data)) {
    const s = r.quest_submissions;
    const key = `${s.quest_id}:${s.user_id}`;
    if ((seen.get(key) ?? 0) > s.attempt_no) continue;
    seen.set(key, s.attempt_no);
    map.set(key, { score: r.score, max: questMax.get(s.quest_id) ?? null, status: r.decision });
  }
  for (const a of z.array(attemptSchema).parse(attempts.data)) {
    const key = `${a.quiz_id}:${a.user_id}`;
    if ((seen.get(key) ?? 0) > a.attempt_no) continue;
    seen.set(key, a.attempt_no);
    map.set(key, { score: a.score, max: a.max_score, status: 'submitted' });
  }
  return map;
}

export async function updateMyProfile(
  userId: string,
  values: { display_name: string; nickname: string | null },
) {
  const { error } = await client().from('profiles').update(values).eq('id', userId);
  if (error) throw error;
}

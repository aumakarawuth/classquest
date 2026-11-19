import { z } from 'zod';
import { supabase } from '@/lib/supabase';

function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

const workSchema = z.object({
  id: z.string(),
  quest_id: z.string(),
  attempt_no: z.number(),
  content_text: z.string().nullable(),
  url: z.string().nullable(),
  storage_path: z.string().nullable(),
  submitted_at: z.string(),
  quests: z.object({ title: z.string(), type: z.string() }),
  quest_reviews: z
    .array(z.object({ score: z.coerce.number().nullable(), feedback: z.string() }))
    .or(
      z.object({ score: z.coerce.number().nullable(), feedback: z.string() }).transform((r) => [r]),
    )
    .or(z.null().transform(() => [])),
});
export type ApprovedWork = z.infer<typeof workSchema>;

const itemSchema = z.object({
  id: z.string(),
  submission_id: z.string(),
  title: z.string(),
  description: z.string(),
  position: z.number(),
});
export type PortfolioItem = z.infer<typeof itemSchema>;
const reflectionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  body: z.string(),
  created_at: z.string(),
});
export type Reflection = z.infer<typeof reflectionSchema>;

export interface PortfolioData {
  visibility: 'private' | 'teacher';
  headline: string;
  exists: boolean;
  items: PortfolioItem[];
  works: ApprovedWork[];
  reflections: Reflection[];
  xp: number;
  badges: { name: string; icon: string; created_at: string }[];
}

/** All portfolio sections in parallel requests; RLS decides what the caller may see. */
export async function getPortfolio(courseId: string, userId: string): Promise<PortfolioData> {
  const c = client();
  const [pf, items, works, reflections, xp, badges] = await Promise.all([
    c
      .from('portfolios')
      .select('visibility, headline')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .maybeSingle(),
    c
      .from('portfolio_items')
      .select('id, submission_id, title, description, position')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .order('position'),
    c
      .from('quest_submissions')
      .select(
        'id, quest_id, attempt_no, content_text, url, storage_path, submitted_at, quests!inner(title, type), quest_reviews(score, feedback)',
      )
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .eq('status', 'approved')
      .order('submitted_at', { ascending: false }),
    c
      .from('student_reflections')
      .select('id, prompt, body, created_at')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .order('created_at', { ascending: false }),
    c.from('xp_transactions').select('amount').eq('user_id', userId).eq('course_id', courseId),
    c
      .from('user_badges')
      .select('created_at, badges!inner(name, icon)')
      .eq('user_id', userId)
      .eq('course_id', courseId),
  ]);
  for (const r of [pf, items, works, reflections, xp, badges]) if (r.error) throw r.error;
  const pfRow = z
    .object({ visibility: z.enum(['private', 'teacher']), headline: z.string() })
    .nullable()
    .parse(pf.data);
  return {
    exists: !!pfRow,
    visibility: pfRow?.visibility ?? 'private',
    headline: pfRow?.headline ?? '',
    items: z.array(itemSchema).parse(items.data),
    works: z.array(workSchema).parse(works.data),
    reflections: z.array(reflectionSchema).parse(reflections.data),
    xp: z
      .array(z.object({ amount: z.number() }))
      .parse(xp.data)
      .reduce((s, r) => s + r.amount, 0),
    badges: z
      .array(
        z.object({
          created_at: z.string(),
          badges: z.object({ name: z.string(), icon: z.string() }),
        }),
      )
      .parse(badges.data)
      .map((b) => ({ ...b.badges, created_at: b.created_at })),
  };
}

export async function savePortfolioSettings(
  userId: string,
  courseId: string,
  visibility: 'private' | 'teacher',
  headline: string,
) {
  const { error } = await client()
    .from('portfolios')
    .upsert({ user_id: userId, course_id: courseId, visibility, headline });
  if (error) throw error;
}

export async function featureWork(
  userId: string,
  courseId: string,
  submissionId: string,
  title: string,
  position: number,
) {
  const { error } = await client()
    .from('portfolio_items')
    .insert({ user_id: userId, course_id: courseId, submission_id: submissionId, title, position });
  if (error) throw error;
}

export async function updateItem(id: string, patch: { title?: string; description?: string }) {
  const { error } = await client().from('portfolio_items').update(patch).eq('id', id);
  if (error) throw error;
}

export async function removeItem(id: string) {
  const { error } = await client().from('portfolio_items').delete().eq('id', id);
  if (error) throw error;
}

export async function addReflection(
  userId: string,
  courseId: string,
  prompt: string,
  body: string,
) {
  const { error } = await client()
    .from('student_reflections')
    .insert({ user_id: userId, course_id: courseId, prompt, body });
  if (error) throw error;
}

export async function deleteReflection(id: string) {
  const { error } = await client().from('student_reflections').delete().eq('id', id);
  if (error) throw error;
}

export const reflectionPrompts = [
  'สิ่งที่ฉันได้เรียนรู้มากที่สุดคือ…',
  'ปัญหาที่ฉันเจอและวิธีแก้ไขคือ…',
  'ฉันจะนำความรู้นี้ไปใช้ในชีวิตจริงหรือการทำงานอย่างไร…',
  'ถ้าทำใหม่ ฉันจะปรับปรุงอะไร…',
];

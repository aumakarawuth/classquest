import { z } from 'zod';
import { supabase } from '@/lib/supabase';

function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

export const evidenceCategories = [
  'problem_needs',
  'objectives',
  'lesson_plan',
  'teaching_media',
  'activity_evidence',
  'prepost_results',
  'competency_results',
  'student_work',
  'satisfaction',
  'student_reflection',
  'teacher_reflection',
  'improvement_history',
  'trial_report',
] as const;
export type EvidenceCategory = (typeof evidenceCategories)[number];
export const categoryLabels: Record<EvidenceCategory, string> = {
  problem_needs: 'ปัญหาและความต้องการของผู้เรียน',
  objectives: 'วัตถุประสงค์ของนวัตกรรม',
  lesson_plan: 'แผนการจัดการเรียนรู้',
  teaching_media: 'สื่อการเรียนการสอน',
  activity_evidence: 'หลักฐานกิจกรรม',
  prepost_results: 'ผลการประเมินก่อนและหลังเรียน',
  competency_results: 'ผลการประเมินสมรรถนะ',
  student_work: 'ตัวอย่างชิ้นงานนักเรียน',
  satisfaction: 'แบบประเมินความพึงพอใจ',
  student_reflection: 'การสะท้อนผลของผู้เรียน',
  teacher_reflection: 'การสะท้อนผลของครู',
  improvement_history: 'ประวัติการปรับปรุงนวัตกรรม',
  trial_report: 'รายงานผลการทดลองใช้',
};

const evidenceSchema = z.object({
  id: z.string(),
  category: z.enum(evidenceCategories),
  title: z.string(),
  body_md: z.string(),
  url: z.string().nullable(),
  occurred_on: z.string().nullable(),
  created_at: z.string(),
});
export type Evidence = z.infer<typeof evidenceSchema>;
export type EvidenceInput = Pick<
  Evidence,
  'category' | 'title' | 'body_md' | 'url' | 'occurred_on'
>;

export async function listEvidence(courseId: string): Promise<Evidence[]> {
  const { data, error } = await client()
    .from('competition_evidence')
    .select('id, category, title, body_md, url, occurred_on, created_at')
    .eq('course_id', courseId)
    .order('occurred_on', { ascending: true, nullsFirst: false })
    .order('created_at');
  if (error) throw error;
  return z.array(evidenceSchema).parse(data);
}

export async function saveEvidence(
  courseId: string,
  userId: string,
  id: string | null,
  input: EvidenceInput,
) {
  const res = id
    ? await client().from('competition_evidence').update(input).eq('id', id)
    : await client()
        .from('competition_evidence')
        .insert({ ...input, course_id: courseId, created_by: userId });
  if (res.error) throw res.error;
}

export async function deleteEvidence(id: string) {
  const { error } = await client().from('competition_evidence').delete().eq('id', id);
  if (error) throw error;
}

export const surveyItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  type: z.enum(['likert', 'text']),
});
export type SurveyItem = z.infer<typeof surveyItemSchema>;
const surveySchema = z.object({
  id: z.string(),
  course_id: z.string(),
  title: z.string(),
  description: z.string(),
  items: z.array(surveyItemSchema),
  anonymous: z.boolean(),
  open: z.boolean(),
});
export type Survey = z.infer<typeof surveySchema>;

export async function listSurveys(courseId: string): Promise<Survey[]> {
  const { data, error } = await client()
    .from('surveys')
    .select('id, course_id, title, description, items, anonymous, open')
    .eq('course_id', courseId)
    .order('created_at');
  if (error) throw error;
  return z.array(surveySchema).parse(data);
}

export async function getSurvey(id: string): Promise<Survey | null> {
  const { data, error } = await client()
    .from('surveys')
    .select('id, course_id, title, description, items, anonymous, open')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? surveySchema.parse(data) : null;
}

export async function saveSurvey(
  courseId: string,
  id: string | null,
  s: Omit<Survey, 'id' | 'course_id'>,
) {
  const res = id
    ? await client().from('surveys').update(s).eq('id', id)
    : await client()
        .from('surveys')
        .insert({ ...s, course_id: courseId });
  if (res.error) throw res.error;
}

export async function myResponses(userId: string, surveyIds: string[]): Promise<string[]> {
  if (!surveyIds.length) return [];
  const { data, error } = await client()
    .from('survey_responses')
    .select('survey_id')
    .eq('user_id', userId)
    .in('survey_id', surveyIds);
  if (error) throw error;
  return z
    .array(z.object({ survey_id: z.string() }))
    .parse(data)
    .map((r) => r.survey_id);
}

export async function submitSurvey(surveyId: string, answers: Record<string, number | string>) {
  const { error } = await client().rpc('submit_survey', {
    _survey_id: surveyId,
    _answers: answers,
  });
  if (error) throw error;
}

const summarySchema = z.object({
  survey_id: z.string(),
  title: z.string(),
  respondents: z.number(),
  enrolled: z.number(),
  items: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        type: z.enum(['likert', 'text']),
        n: z.number().optional(),
        mean: z.coerce.number().nullable().optional(),
        sd: z.coerce.number().nullable().optional(),
        distribution: z.record(z.string(), z.number()).optional(),
        answers: z.array(z.string()).optional(),
      }),
    )
    .nullable(),
});
export type SurveySummary = z.infer<typeof summarySchema>;

export async function surveySummary(id: string): Promise<SurveySummary> {
  const { data, error } = await client().rpc('survey_summary', { _survey_id: id });
  if (error) throw error;
  return summarySchema.parse(data);
}

export async function competencySummary(courseId: string) {
  const { data, error } = await client().rpc('competency_summary', { _course_id: courseId });
  if (error) throw error;
  return z
    .array(
      z.object({
        code: z.string(),
        name: z.string(),
        assessed: z.number(),
        passed: z.number(),
        students: z.number(),
      }),
    )
    .parse(data);
}

/** Thai interpretation bands commonly used for 5-point Likert means. */
export function likertLevel(mean: number | null | undefined): string {
  if (mean === null || mean === undefined) return '–';
  if (mean >= 4.51) return 'มากที่สุด';
  if (mean >= 3.51) return 'มาก';
  if (mean >= 2.51) return 'ปานกลาง';
  if (mean >= 1.51) return 'น้อย';
  return 'น้อยที่สุด';
}

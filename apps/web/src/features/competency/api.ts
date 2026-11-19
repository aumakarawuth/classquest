import { z } from 'zod';
import { supabase } from '@/lib/supabase';

function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

const competencySchema = z.object({
  id: z.string(),
  course_id: z.string(),
  parent_id: z.string().nullable(),
  code: z.string(),
  name: z.string(),
  description: z.string(),
  pass_threshold: z.coerce.number(),
  position: z.number(),
});
export type Competency = z.infer<typeof competencySchema>;

export async function listCompetencies(courseId: string): Promise<Competency[]> {
  const { data, error } = await client()
    .from('competencies')
    .select('id, course_id, parent_id, code, name, description, pass_threshold, position')
    .eq('course_id', courseId)
    .order('position')
    .order('code');
  if (error) throw error;
  return z.array(competencySchema).parse(data);
}

export interface CompetencyInput {
  code: string;
  name: string;
  description: string;
  parent_id: string | null;
  pass_threshold: number;
  position: number;
}

export async function saveCompetency(courseId: string, id: string | null, input: CompetencyInput) {
  const res = id
    ? await client().from('competencies').update(input).eq('id', id)
    : await client()
        .from('competencies')
        .insert({ ...input, course_id: courseId });
  if (res.error) throw res.error;
}

export async function deleteCompetency(id: string) {
  const { error } = await client().from('competencies').delete().eq('id', id);
  if (error) throw error;
}

const mappingSchema = z.object({
  competency_id: z.string(),
  target_type: z.string(),
  target_id: z.string(),
});
export async function listMappings(courseId: string) {
  const { data, error } = await client()
    .from('competency_mappings')
    .select('competency_id, target_type, target_id')
    .eq('course_id', courseId);
  if (error) throw error;
  return z.array(mappingSchema).parse(data);
}

export async function setQuestMappings(courseId: string, competencyId: string, questIds: string[]) {
  const del = await client()
    .from('competency_mappings')
    .delete()
    .eq('competency_id', competencyId)
    .eq('target_type', 'quest');
  if (del.error) throw del.error;
  if (!questIds.length) return;
  const ins = await client()
    .from('competency_mappings')
    .insert(
      questIds.map((target_id) => ({
        competency_id: competencyId,
        course_id: courseId,
        target_type: 'quest',
        target_id,
      })),
    );
  if (ins.error) throw ins.error;
}

const matrixSchema = z.object({
  user_id: z.string(),
  display_name: z.string(),
  competency_id: z.string(),
  score_percent: z.coerce.number().nullable(),
  passed: z.boolean().nullable(),
  evidence_count: z.number(),
  last_assessed_at: z.string().nullable(),
});
export type MatrixCell = z.infer<typeof matrixSchema>;

/** Latest evidence per (student, competency), computed in the database. Students only get their own rows. */
export async function getMatrix(courseId: string, userId?: string): Promise<MatrixCell[]> {
  const { data, error } = await client().rpc('competency_matrix', {
    _course_id: courseId,
    _user_id: userId ?? null,
  });
  if (error) throw error;
  return z.array(matrixSchema).parse(data);
}

const evidenceSchema = z.object({
  id: z.string(),
  competency_id: z.string(),
  score_percent: z.coerce.number(),
  source_type: z.enum(['rubric', 'quest', 'quiz', 'manual']),
  note: z.string(),
  created_at: z.string(),
});
export type Evidence = z.infer<typeof evidenceSchema>;

export async function listEvidence(courseId: string, userId: string): Promise<Evidence[]> {
  const { data, error } = await client()
    .from('competency_results')
    .select('id, competency_id, score_percent, source_type, note, created_at')
    .eq('course_id', courseId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return z.array(evidenceSchema).parse(data);
}

export async function recordCompetencyResult(
  competencyId: string,
  userId: string,
  percent: number,
  note: string,
) {
  const { error } = await client().rpc('record_competency_result', {
    _competency_id: competencyId,
    _user_id: userId,
    _score_percent: percent,
    _note: note,
  });
  if (error) throw error;
}

export type CompetencyStatus = 'passed' | 'developing' | 'not_assessed';
export function cellStatus(cell: Pick<MatrixCell, 'passed'> | undefined): CompetencyStatus {
  if (!cell || cell.passed === null) return 'not_assessed';
  return cell.passed ? 'passed' : 'developing';
}
export const statusLabels: Record<CompetencyStatus, string> = {
  passed: 'ผ่าน',
  developing: 'ต้องพัฒนา',
  not_assessed: 'ยังไม่ประเมิน',
};
export const sourceLabels: Record<Evidence['source_type'], string> = {
  rubric: 'Rubric ภารกิจ',
  quest: 'คะแนนภารกิจ',
  quiz: 'แบบทดสอบ',
  manual: 'ครูประเมิน',
};

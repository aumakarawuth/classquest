import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { questStages, resourceTypes, type ResourceFormValues, type QuestStage } from './resources';

function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

const lessonSummary = z.object({
  id: z.string(),
  title: z.string(),
  position: z.number(),
  published: z.boolean(),
  quest_stage: z.enum(questStages).nullable(),
});
const unitSchema = z.object({
  id: z.string(),
  position: z.number(),
  week_no: z.number().nullable(),
  title: z.string(),
  published: z.boolean(),
  lessons: z.array(lessonSummary),
});
export type BuilderUnit = z.infer<typeof unitSchema>;
export type LessonSummary = z.infer<typeof lessonSummary>;

/** All units with their lessons in one request. */
export async function getBuilder(courseId: string): Promise<BuilderUnit[]> {
  const { data, error } = await client()
    .from('learning_units')
    .select(
      'id, position, week_no, title, published, lessons(id, title, position, published, quest_stage)',
    )
    .eq('course_id', courseId)
    .order('position')
    .order('position', { referencedTable: 'lessons' });
  if (error) throw error;
  return z.array(unitSchema).parse(data);
}

export async function updateUnit(unitId: string, patch: { title?: string; published?: boolean }) {
  const { error } = await client().from('learning_units').update(patch).eq('id', unitId);
  if (error) throw error;
}

export async function createLesson(
  unitId: string,
  title: string,
  position: number,
): Promise<string> {
  // course_id is derived from the unit by a trigger; send a placeholder-free insert
  const { data, error } = await client()
    .from('lessons')
    .insert({ unit_id: unitId, title, position })
    .select('id')
    .single();
  if (error) throw error;
  return z.object({ id: z.string() }).parse(data).id;
}

export async function deleteLesson(lessonId: string) {
  const { error } = await client().from('lessons').delete().eq('id', lessonId);
  if (error) throw error;
}

export async function setLessonPublished(lessonId: string, published: boolean) {
  const { error } = await client().from('lessons').update({ published }).eq('id', lessonId);
  if (error) throw error;
}

export async function reorderLessons(unitId: string, lessonIds: string[]) {
  const { error } = await client().rpc('reorder_lessons', {
    _unit_id: unitId,
    _lesson_ids: lessonIds,
  });
  if (error) throw error;
}

const resourceSchema = z.object({
  id: z.string(),
  position: z.number(),
  type: z.enum(resourceTypes),
  title: z.string(),
  url: z.string().nullable(),
  content: z.string().nullable(),
});
export type LessonResource = z.infer<typeof resourceSchema>;

const lessonSchema = z.object({
  id: z.string(),
  course_id: z.string(),
  unit_id: z.string(),
  title: z.string(),
  body_md: z.string(),
  quest_stage: z.enum(questStages).nullable(),
  prerequisite_lesson_id: z.string().nullable(),
  estimated_minutes: z.number().nullable(),
  published: z.boolean(),
  lesson_resources: z.array(resourceSchema),
});
export type LessonDetail = z.infer<typeof lessonSchema>;

export async function getLesson(lessonId: string): Promise<LessonDetail | null> {
  const { data, error } = await client()
    .from('lessons')
    .select(
      'id, course_id, unit_id, title, body_md, quest_stage, prerequisite_lesson_id, estimated_minutes, published, lesson_resources(id, position, type, title, url, content)',
    )
    .eq('id', lessonId)
    .order('position', { referencedTable: 'lesson_resources' })
    .maybeSingle();
  if (error) throw error;
  return data ? lessonSchema.parse(data) : null;
}

export interface LessonPatch {
  title: string;
  body_md: string;
  quest_stage: QuestStage | null;
  prerequisite_lesson_id: string | null;
  estimated_minutes: number | null;
  published: boolean;
}

export async function updateLesson(lessonId: string, patch: LessonPatch) {
  const { error } = await client().from('lessons').update(patch).eq('id', lessonId);
  if (error) throw error;
}

export async function listCourseLessons(courseId: string) {
  const { data, error } = await client()
    .from('lessons')
    .select('id, title, unit_id, position')
    .eq('course_id', courseId)
    .order('unit_id')
    .order('position')
    .limit(500);
  if (error) throw error;
  return z.array(z.object({ id: z.string(), title: z.string() }).passthrough()).parse(data);
}

export async function addResource(lessonId: string, position: number, values: ResourceFormValues) {
  const isContent = values.type === 'text' || values.type === 'code';
  const { error } = await client()
    .from('lesson_resources')
    .insert({
      lesson_id: lessonId,
      position,
      type: values.type,
      title: values.title,
      url: isContent ? null : values.url,
      content: isContent ? values.content : null,
    });
  if (error) throw error;
}

export async function deleteResource(resourceId: string) {
  const { error } = await client().from('lesson_resources').delete().eq('id', resourceId);
  if (error) throw error;
}

export async function reorderResources(lessonId: string, ids: string[]) {
  const { error } = await client().rpc('reorder_resources', {
    _lesson_id: lessonId,
    _resource_ids: ids,
  });
  if (error) throw error;
}

export function learningErrorMessage(error: unknown): string {
  const e = error as { message?: string; code?: string } | null;
  if (e?.message?.includes('CQ_INVALID_ORDER')) return 'ลำดับไม่ถูกต้อง กรุณาโหลดหน้าใหม่';
  if (e?.code === '42501') return 'คุณไม่มีสิทธิ์แก้ไขรายวิชานี้';
  if (e?.code === '23505') return 'ลำดับซ้ำกัน กรุณาโหลดหน้าใหม่';
  return 'บันทึกไม่สำเร็จ กรุณาลองใหม่';
}

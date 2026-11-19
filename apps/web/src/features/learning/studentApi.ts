import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { questStages } from './resources';
import type { RoadmapUnitInput } from './roadmap';

function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

const unitSchema = z.object({
  id: z.string(),
  position: z.number(),
  title: z.string(),
  lessons: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      position: z.number(),
      quest_stage: z.enum(questStages).nullable(),
      prerequisite_lesson_id: z.string().nullable(),
      estimated_minutes: z.number().nullable(),
    }),
  ),
});

export interface RoadmapData {
  units: RoadmapUnitInput[];
  completedIds: Set<string>;
}

/** Visible units/lessons (RLS hides unpublished) + the student's own completions: two requests total. */
export async function getRoadmapData(courseId: string, userId: string): Promise<RoadmapData> {
  const [units, progress] = await Promise.all([
    client()
      .from('learning_units')
      .select(
        'id, position, title, lessons(id, title, position, quest_stage, prerequisite_lesson_id, estimated_minutes)',
      )
      .eq('course_id', courseId)
      .order('position'),
    client()
      .from('lesson_progress')
      .select('lesson_id, lessons!inner(course_id)')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .eq('lessons.course_id', courseId),
  ]);
  if (units.error) throw units.error;
  if (progress.error) throw progress.error;
  return {
    units: z.array(unitSchema).parse(units.data),
    completedIds: new Set(
      z
        .array(z.object({ lesson_id: z.string() }).passthrough())
        .parse(progress.data)
        .map((p) => p.lesson_id),
    ),
  };
}

export async function completeLesson(lessonId: string): Promise<void> {
  const { error } = await client().rpc('complete_lesson', { _lesson_id: lessonId });
  if (error) throw error;
}

export function studentLearningError(error: unknown): string {
  const message = (error as { message?: string } | null)?.message ?? '';
  if (message.includes('CQ_LOCKED')) return 'ต้องเรียนบทเรียนก่อนหน้าให้จบก่อน';
  if (message.includes('CQ_FORBIDDEN')) return 'บทเรียนนี้ยังไม่เปิดให้เรียน';
  return 'บันทึกไม่สำเร็จ กรุณาลองใหม่';
}

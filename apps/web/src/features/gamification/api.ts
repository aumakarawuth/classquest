import { z } from 'zod';
import { supabase } from '@/lib/supabase';

function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

const progressSchema = z.object({
  xp: z.number(),
  level: z.number().nullable(),
  level_title: z.string().nullable(),
  level_floor: z.number().nullable(),
  next_threshold: z.number().nullable(),
});
export type CourseProgress = z.infer<typeof progressSchema>;

/** XP and level are computed in the database from the XP ledger. */
export async function getMyProgress(courseId: string): Promise<CourseProgress | null> {
  const { data, error } = await client().rpc('my_course_progress', { _course_id: courseId });
  if (error) throw error;
  const rows = z.array(progressSchema).parse(data);
  return rows[0] ?? null;
}

const levelSchema = z.object({
  level: z.number(),
  xp_threshold: z.number(),
  title: z.string(),
  course_id: z.string().nullable(),
});
export type LevelDefinition = z.infer<typeof levelSchema>;

/** Course-specific ladder if defined, otherwise the global default ladder. */
export async function getLevels(
  courseId: string,
): Promise<{ levels: LevelDefinition[]; custom: boolean }> {
  const { data, error } = await client()
    .from('level_definitions')
    .select('level, xp_threshold, title, course_id')
    .or(`course_id.eq.${courseId},course_id.is.null`)
    .order('level');
  if (error) throw error;
  const all = z.array(levelSchema).parse(data);
  const course = all.filter((l) => l.course_id === courseId);
  return course.length
    ? { levels: course, custom: true }
    : { levels: all.filter((l) => !l.course_id), custom: false };
}

export async function saveCourseLevels(
  courseId: string,
  levels: { xp_threshold: number; title: string }[],
) {
  const { error } = await client().rpc('save_course_levels', {
    _course_id: courseId,
    _levels: levels,
  });
  if (error) throw error;
}

/** Validates a ladder the same way the server does. Returns a Thai error or null. */
export function validateLadder(levels: { xp_threshold: number }[]): string | null {
  if (!levels.length) return null;
  if (levels[0]?.xp_threshold !== 0) return 'เลเวล 1 ต้องเริ่มที่ 0 XP';
  for (let i = 1; i < levels.length; i++) {
    const prev = levels[i - 1]?.xp_threshold ?? 0;
    const cur = levels[i]?.xp_threshold ?? 0;
    if (!Number.isInteger(cur) || cur <= prev) return `XP ของเลเวล ${i + 1} ต้องมากกว่าเลเวล ${i}`;
  }
  return null;
}

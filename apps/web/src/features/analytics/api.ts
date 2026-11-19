import { z } from 'zod';
import { supabase } from '@/lib/supabase';

const num = z.coerce.number().nullable();
const studentSchema = z.object({
  user_id: z.string(),
  display_name: z.string(),
  student_code: z.string().nullable(),
  last_active: z.string().nullable(),
  lessons_done: z.number(),
  quests_approved: z.number(),
  needs_revision: z.number(),
  avg_quest_pct: num,
  avg_quiz_pct: num,
  xp: z.coerce.number(),
  competencies_developing: z.number(),
  flags: z.array(
    z.enum([
      'inactive_7d',
      'behind_lessons',
      'needs_revision',
      'low_quiz',
      'competency_developing',
    ]),
  ),
});
const dashboardSchema = z.object({
  students_total: z.number(),
  active_7d: z.number(),
  lessons_total: z.number(),
  quests_total: z.number(),
  lesson_completion_rate: num,
  quest_completion_rate: num,
  pending_reviews: z.number(),
  avg_quest_pct: num,
  avg_quiz_pct: num,
  pretest_mean: num,
  posttest_mean: num,
  competency_pass_rate: num,
  competency_assessed_rate: num,
  students: z.array(studentSchema),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
export type DashboardStudent = z.infer<typeof studentSchema>;
export type SupportFlag = DashboardStudent['flags'][number];

export const flagLabels: Record<SupportFlag, string> = {
  inactive_7d: 'ไม่ได้เข้าเรียน 7 วัน',
  behind_lessons: 'บทเรียนช้ากว่าเพื่อนมาก',
  needs_revision: 'มีงานต้องแก้ไข',
  low_quiz: 'คะแนนแบบทดสอบต่ำกว่า 50%',
  competency_developing: 'มีสมรรถนะต้องพัฒนา',
};

/** Everything on the dashboard comes from one RPC (computed from real data in the database). */
export async function getDashboard(
  courseId: string,
  unitId: string | null,
  days: number | null,
): Promise<Dashboard> {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.rpc('teacher_dashboard', {
    _course_id: courseId,
    _unit_id: unitId,
    _days: days,
  });
  if (error) throw error;
  return dashboardSchema.parse(data);
}

export async function touchActivity(): Promise<void> {
  if (!supabase) return;
  await supabase.rpc('touch_activity');
}

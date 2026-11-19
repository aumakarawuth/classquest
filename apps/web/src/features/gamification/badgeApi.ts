import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { badgeIconNames, ruleSchema, type BadgeRule } from './badges';

function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

const badgeSchema = z.object({
  id: z.string(),
  course_id: z.string().nullable(),
  name: z.string(),
  description: z.string(),
  icon: z.enum(badgeIconNames as [string, ...string[]]),
  xp_bonus: z.number(),
  rule: ruleSchema.nullable(),
  active: z.boolean(),
});
export type Badge = z.infer<typeof badgeSchema> & { icon: (typeof badgeIconNames)[number] };

const BADGE_COLUMNS = 'id, course_id, name, description, icon, xp_bonus, rule, active';

/** Global badges + badges of the given courses (RLS limits to visible courses). */
export async function listBadges(courseIds: string[]): Promise<Badge[]> {
  const filter = courseIds.length
    ? `course_id.is.null,course_id.in.(${courseIds.join(',')})`
    : 'course_id.is.null';
  const { data, error } = await client()
    .from('badges')
    .select(BADGE_COLUMNS)
    .or(filter)
    .order('created_at');
  if (error) throw error;
  return z.array(badgeSchema).parse(data) as Badge[];
}

const earnedSchema = z.object({
  id: z.string(),
  badge_id: z.string(),
  course_id: z.string(),
  user_id: z.string(),
  reason: z.string(),
  created_at: z.string(),
});
export type EarnedBadge = z.infer<typeof earnedSchema>;

export async function listMyBadges(userId: string): Promise<EarnedBadge[]> {
  const { data, error } = await client()
    .from('user_badges')
    .select('id, badge_id, course_id, user_id, reason, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return z.array(earnedSchema).parse(data);
}

export async function listCourseAwards(courseId: string): Promise<EarnedBadge[]> {
  const { data, error } = await client()
    .from('user_badges')
    .select('id, badge_id, course_id, user_id, reason, created_at')
    .eq('course_id', courseId)
    .limit(2000);
  if (error) throw error;
  return z.array(earnedSchema).parse(data);
}

export interface BadgeInput {
  name: string;
  description: string;
  icon: string;
  xp_bonus: number;
  rule: BadgeRule | null;
}

export async function createCourseBadge(courseId: string, input: BadgeInput) {
  const { error } = await client()
    .from('badges')
    .insert({ ...input, course_id: courseId });
  if (error) throw error;
}

export async function setBadgeActive(badgeId: string, active: boolean) {
  const { error } = await client().from('badges').update({ active }).eq('id', badgeId);
  if (error) throw error;
}

export async function awardBadge(
  badgeId: string,
  userId: string,
  courseId: string,
  reason: string,
) {
  const { data, error } = await client().rpc('award_badge', {
    _badge_id: badgeId,
    _user_id: userId,
    _course_id: courseId,
    _reason: reason,
  });
  if (error) throw error;
  return z.boolean().parse(data);
}

export async function listCourseStudents(courseId: string) {
  const { data, error } = await client()
    .from('course_members')
    .select('user_id, profiles!course_members_user_id_fkey(display_name)')
    .eq('course_id', courseId)
    .eq('member_role', 'student')
    .limit(500);
  if (error) throw error;
  return z
    .array(z.object({ user_id: z.string(), profiles: z.object({ display_name: z.string() }) }))
    .parse(data)
    .map((r) => ({ id: r.user_id, name: r.profiles.display_name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'th'));
}

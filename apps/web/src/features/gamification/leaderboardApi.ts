import { z } from 'zod';
import { supabase } from '@/lib/supabase';

function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

const rowSchema = z.object({
  rank: z.number(),
  nickname: z.string(),
  level: z.number().nullable(),
  xp: z.number(),
  is_me: z.boolean(),
});
export type LeaderboardRow = z.infer<typeof rowSchema>;

/** Returns nickname/level/XP only — no names, emails or scores leave the database. */
export async function getLeaderboard(courseId: string): Promise<LeaderboardRow[]> {
  const { data, error } = await client().rpc('get_leaderboard', { _course_id: courseId });
  if (error) throw error;
  return z.array(rowSchema).parse(data);
}

export async function getLeaderboardStatus(courseId: string) {
  const { data, error } = await client().rpc('leaderboard_status', { _course_id: courseId });
  if (error) throw error;
  const row = z
    .array(z.object({ system_enabled: z.boolean(), course_enabled: z.boolean() }))
    .parse(data)[0];
  return row ?? { system_enabled: false, course_enabled: false };
}

export async function setCourseLeaderboard(courseId: string, enabled: boolean) {
  const { error } = await client().rpc('set_course_leaderboard', {
    _course_id: courseId,
    _enabled: enabled,
  });
  if (error) throw error;
}

export async function getMyLeaderboardPrefs(userId: string) {
  const { data, error } = await client()
    .from('profiles')
    .select('nickname, leaderboard_opt_in')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return z.object({ nickname: z.string().nullable(), leaderboard_opt_in: z.boolean() }).parse(data);
}

export async function updateMyLeaderboardPrefs(userId: string, optIn: boolean, nickname: string) {
  const { error } = await client()
    .from('profiles')
    .update({ leaderboard_opt_in: optIn, nickname: nickname.trim() || null })
    .eq('id', userId);
  if (error) throw error;
}

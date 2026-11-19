import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import type { RosterRow } from './csv';

function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

export const CLASSROOM_URL = /^https:\/\/classroom\.google\.com\//;

export async function getConnection(courseId: string): Promise<string | null> {
  const { data, error } = await client()
    .from('classroom_connections')
    .select('gc_link')
    .eq('course_id', courseId)
    .maybeSingle();
  if (error) throw error;
  return data ? z.object({ gc_link: z.string() }).parse(data).gc_link : null;
}

export async function saveConnection(courseId: string, link: string, userId: string) {
  const { error } = await client()
    .from('classroom_connections')
    .upsert({ course_id: courseId, gc_link: link.trim(), mode: 'link', connected_by: userId });
  if (error) throw error;
}

export async function removeConnection(courseId: string) {
  const { error } = await client().from('classroom_connections').delete().eq('course_id', courseId);
  if (error) throw error;
}

export async function importRoster(courseId: string, rows: RosterRow[]) {
  const { data, error } = await client().rpc('import_roster', {
    _course_id: courseId,
    _rows: rows,
  });
  if (error) throw error;
  return z
    .object({ invited: z.number(), enrolled_now: z.number(), invalid: z.number() })
    .parse(data);
}

const inviteSchema = z.object({
  id: z.string(),
  email: z.string(),
  student_code: z.string().nullable(),
  display_name: z.string().nullable(),
  claimed_at: z.string().nullable(),
});
export type Invite = z.infer<typeof inviteSchema>;

export async function listInvites(courseId: string): Promise<Invite[]> {
  const { data, error } = await client()
    .from('roster_invites')
    .select('id, email, student_code, display_name, claimed_at')
    .eq('course_id', courseId)
    .order('email')
    .limit(1000);
  if (error) throw error;
  return z.array(inviteSchema).parse(data);
}

const gradebookSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      type: z.enum(['quest', 'quiz']),
      title: z.string(),
      max: z.coerce.number(),
    }),
  ),
  students: z.array(
    z.object({
      user_id: z.string(),
      email: z.string(),
      display_name: z.string(),
      student_code: z.string().nullable(),
      xp: z.coerce.number(),
      scores: z.record(z.string(), z.coerce.number().nullable()),
    }),
  ),
});
export type Gradebook = z.infer<typeof gradebookSchema>;

export async function gradebookExport(courseId: string): Promise<Gradebook> {
  const { data, error } = await client().rpc('gradebook_export', { _course_id: courseId });
  if (error) throw error;
  return gradebookSchema.parse(data);
}

/** Classroom-friendly layout: identity columns first, one column per item; XP kept separate (not a grade). */
export function gradebookRows(g: Gradebook, includeXp: boolean): (string | number | null)[][] {
  const header = [
    'Email',
    'ชื่อ',
    'รหัสนักเรียน',
    ...g.items.map((i) => `${i.title} (${i.max})`),
    ...(includeXp ? ['XP (ไม่ใช่คะแนน)'] : []),
  ];
  const rows = g.students.map((s) => [
    s.email,
    s.display_name,
    s.student_code,
    ...g.items.map((i) => s.scores[i.id] ?? null),
    ...(includeXp ? [s.xp] : []),
  ]);
  return [header, ...rows];
}

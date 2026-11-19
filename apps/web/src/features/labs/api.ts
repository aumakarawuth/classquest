import { z } from 'zod';
import { supabase } from '@/lib/supabase';

function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

export const WOKWI_PROJECT = /^https:\/\/wokwi\.com\/projects\/[A-Za-z0-9_-]+/;

const labSchema = z.object({
  id: z.string(),
  course_id: z.string(),
  unit_id: z.string().nullable(),
  quest_id: z.string().nullable(),
  title: z.string(),
  project_url: z.string(),
  allow_embed: z.boolean(),
  instructions_md: z.string(),
  diagram_url: z.string().nullable(),
  source_code: z.string(),
  expected_result: z.string(),
  components: z.array(z.string()),
  position: z.number(),
  published: z.boolean(),
});
export type Lab = z.infer<typeof labSchema>;
export type LabInput = Omit<Lab, 'id' | 'course_id'>;

const COLS =
  'id, course_id, unit_id, quest_id, title, project_url, allow_embed, instructions_md, diagram_url, source_code, expected_result, components, position, published';

export async function listLabs(courseIds: string[]): Promise<Lab[]> {
  if (!courseIds.length) return [];
  const { data, error } = await client()
    .from('virtual_labs')
    .select(COLS)
    .in('course_id', courseIds)
    .order('position');
  if (error) throw error;
  return z.array(labSchema).parse(data);
}

export async function getLab(id: string): Promise<Lab | null> {
  const { data, error } = await client()
    .from('virtual_labs')
    .select(COLS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? labSchema.parse(data) : null;
}

export async function saveLab(courseId: string, id: string | null, input: LabInput) {
  const res = id
    ? await client().from('virtual_labs').update(input).eq('id', id)
    : await client()
        .from('virtual_labs')
        .insert({ ...input, course_id: courseId });
  if (res.error) throw res.error;
}

export async function deleteLab(id: string) {
  const { error } = await client().from('virtual_labs').delete().eq('id', id);
  if (error) throw error;
}

/** System-wide switch (admin). Embedding is used only when this AND the lab's own flag are on. */
export async function getWokwiEmbedEnabled(): Promise<boolean> {
  const { data, error } = await client()
    .from('system_settings')
    .select('value')
    .eq('key', 'feature.wokwi_embed')
    .maybeSingle();
  if (error) throw error;
  return data?.value === true;
}

export function validateLab(
  v: Pick<LabInput, 'title' | 'project_url' | 'diagram_url'>,
): string | null {
  if (!v.title.trim()) return 'กรุณากรอกชื่อการทดลอง';
  if (!WOKWI_PROJECT.test(v.project_url.trim()))
    return 'ลิงก์ต้องเป็นโปรเจกต์ Wokwi เช่น https://wokwi.com/projects/123…';
  if (v.diagram_url && !/^https:\/\//.test(v.diagram_url))
    return 'ลิงก์แผนภาพวงจรต้องขึ้นต้นด้วย https://';
  return null;
}

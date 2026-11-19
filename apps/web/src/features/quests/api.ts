import { z } from 'zod';
import { questStages } from '@/features/learning/resources';
import { supabase } from '@/lib/supabase';
import {
  bangkokLocalToIso,
  questTypes,
  submitModes,
  type QuestFormValues,
  type SubmissionStatus,
} from './model';

function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

const questSchema = z.object({
  id: z.string(),
  course_id: z.string(),
  unit_id: z.string().nullable(),
  type: z.enum(questTypes),
  title: z.string(),
  description_md: z.string(),
  objectives: z.string(),
  quest_stage: z.enum(questStages).nullable(),
  difficulty: z.number(),
  max_score: z.coerce.number(),
  xp_reward: z.number(),
  due_at: z.string().nullable(),
  allow_late: z.boolean(),
  submit_modes: z.array(z.enum(submitModes)),
  classroom_url: z.string().nullable(),
  max_attempts: z.number(),
  position: z.number(),
  published: z.boolean(),
  rubric_id: z.string().nullable(),
  quest_prerequisites: z.array(z.object({ required_quest_id: z.string() })),
});
export type Quest = z.infer<typeof questSchema>;

const QUEST_COLUMNS =
  'id, course_id, unit_id, type, title, description_md, objectives, quest_stage, difficulty, max_score, xp_reward, due_at, allow_late, submit_modes, classroom_url, max_attempts, position, published, rubric_id, quest_prerequisites!quest_prerequisites_quest_id_fkey(required_quest_id)';

export async function listCourseQuests(courseId: string): Promise<Quest[]> {
  const { data, error } = await client()
    .from('quests')
    .select(QUEST_COLUMNS)
    .eq('course_id', courseId)
    .order('position')
    .order('created_at')
    .limit(200);
  if (error) throw error;
  return z.array(questSchema).parse(data);
}

export async function getQuest(questId: string): Promise<Quest | null> {
  const { data, error } = await client()
    .from('quests')
    .select(QUEST_COLUMNS)
    .eq('id', questId)
    .maybeSingle();
  if (error) throw error;
  return data ? questSchema.parse(data) : null;
}

function toRow(courseId: string, v: QuestFormValues) {
  return {
    course_id: courseId,
    title: v.title,
    type: v.type,
    unit_id: v.unitId || null,
    quest_stage: v.questStage || null,
    description_md: v.descriptionMd,
    objectives: v.objectives,
    difficulty: v.difficulty,
    max_score: v.maxScore,
    xp_reward: v.xpReward,
    due_at: bangkokLocalToIso(v.dueAt),
    allow_late: v.allowLate,
    submit_modes: v.submitModes,
    classroom_url: v.submitModes.includes('classroom') ? v.classroomUrl : null,
    max_attempts: v.maxAttempts,
    published: v.published,
  };
}

async function syncPrerequisites(questId: string, ids: string[]) {
  const del = await client().from('quest_prerequisites').delete().eq('quest_id', questId);
  if (del.error) throw del.error;
  if (ids.length) {
    const ins = await client()
      .from('quest_prerequisites')
      .insert(ids.map((required_quest_id) => ({ quest_id: questId, required_quest_id })));
    if (ins.error) throw ins.error;
  }
}

export async function saveQuest(
  courseId: string,
  questId: string | null,
  v: QuestFormValues,
): Promise<string> {
  let id = questId;
  if (id) {
    const { error } = await client().from('quests').update(toRow(courseId, v)).eq('id', id);
    if (error) throw error;
  } else {
    const { data, error } = await client()
      .from('quests')
      .insert(toRow(courseId, v))
      .select('id')
      .single();
    if (error) throw error;
    id = z.object({ id: z.string() }).parse(data).id;
  }
  await syncPrerequisites(
    id,
    v.prerequisiteIds.filter((p) => p !== id),
  );
  return id;
}

export async function deleteQuest(questId: string) {
  const { error } = await client().from('quests').delete().eq('id', questId);
  if (error) throw error;
}

const submissionSchema = z.object({
  id: z.string(),
  quest_id: z.string(),
  attempt_no: z.number(),
  content_text: z.string().nullable(),
  url: z.string().nullable(),
  storage_path: z.string().nullable(),
  status: z.enum(['submitted', 'needs_revision', 'approved']),
  is_late: z.boolean(),
  submitted_at: z.string(),
});
export type Submission = z.infer<typeof submissionSchema> & { status: SubmissionStatus };

/** The student's own submissions for the given quests (newest first). */
export async function listMySubmissions(userId: string, questIds: string[]): Promise<Submission[]> {
  if (!questIds.length) return [];
  const { data, error } = await client()
    .from('quest_submissions')
    .select(
      'id, quest_id, attempt_no, content_text, url, storage_path, status, is_late, submitted_at',
    )
    .eq('user_id', userId)
    .in('quest_id', questIds)
    .order('attempt_no', { ascending: false });
  if (error) throw error;
  return z.array(submissionSchema).parse(data);
}

/** Published quests of every course the student belongs to (RLS) + their courses' names. */
export async function listStudentQuests(): Promise<
  (Quest & { courses: { code: string; name: string } })[]
> {
  const { data, error } = await client()
    .from('quests')
    .select(`${QUEST_COLUMNS}, courses!inner(code, name, status)`)
    .eq('published', true)
    .eq('courses.status', 'published')
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(300);
  if (error) throw error;
  return z
    .array(questSchema.extend({ courses: z.object({ code: z.string(), name: z.string() }) }))
    .parse(data);
}

export async function uploadSubmissionFile(
  courseId: string,
  userId: string,
  file: File,
): Promise<string> {
  const ext = (file.name.split('.').pop() ?? 'bin')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 5);
  const path = `${courseId}/${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await client().storage.from('submissions').upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function submitQuest(
  questId: string,
  text: string | null,
  url: string | null,
  path: string | null,
) {
  const { error } = await client().rpc('submit_quest', {
    _quest_id: questId,
    _text: text,
    _url: url,
    _storage_path: path,
  });
  if (error) throw error;
}

export async function signedFileUrl(path: string): Promise<string> {
  const { data, error } = await client().storage.from('submissions').createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}

export function questErrorMessage(error: unknown): string {
  const message = (error as { message?: string } | null)?.message ?? '';
  const map: [string, string][] = [
    ['CQ_ALREADY_SUBMITTED', 'ส่งงานแล้ว กรุณารอครูตรวจ'],
    ['CQ_NO_ATTEMPTS_LEFT', 'ส่งงานครบจำนวนครั้งที่กำหนดแล้ว'],
    ['CQ_PAST_DUE', 'เลยกำหนดส่งแล้ว'],
    ['CQ_LOCKED', 'ต้องผ่านภารกิจก่อนหน้าก่อน'],
    ['CQ_MODE_NOT_ALLOWED', 'ภารกิจนี้ไม่รับวิธีส่งที่เลือก'],
    ['CQ_EMPTY_SUBMISSION', 'กรุณาใส่คำตอบ ลิงก์ หรือไฟล์'],
    ['CQ_INVALID_FILE', 'ไฟล์ไม่ถูกต้อง กรุณาอัปโหลดใหม่'],
    ['CQ_FORBIDDEN', 'คุณไม่มีสิทธิ์ทำรายการนี้'],
    ['CQ_UNIT_COURSE_MISMATCH', 'หน่วยการเรียนรู้ไม่อยู่ในรายวิชานี้'],
  ];
  return map.find(([code]) => message.includes(code))?.[1] ?? 'ทำรายการไม่สำเร็จ กรุณาลองใหม่';
}

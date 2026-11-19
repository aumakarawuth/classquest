import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import {
  courseLevelEnum,
  courseStatusEnum,
  type CourseFormValues,
  type CourseStatus,
} from './schemas';

function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

const courseSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  level: courseLevelEnum,
  classroom: z.string(),
  term: z.number(),
  academic_year: z.number(),
  description: z.string().nullable(),
  status: courseStatusEnum,
  weeks: z.number(),
  created_at: z.string(),
});

export interface Course {
  id: string;
  code: string;
  name: string;
  level: z.infer<typeof courseLevelEnum>;
  classroom: string;
  term: number;
  academicYear: number;
  description: string | null;
  status: CourseStatus;
  weeks: number;
  createdAt: string;
}

const toCourse = (row: z.infer<typeof courseSchema>): Course => ({
  id: row.id,
  code: row.code,
  name: row.name,
  level: row.level,
  classroom: row.classroom,
  term: row.term,
  academicYear: row.academic_year,
  description: row.description,
  status: row.status,
  weeks: row.weeks,
  createdAt: row.created_at,
});

const COURSE_COLUMNS =
  'id, code, name, level, classroom, term, academic_year, description, status, weeks, created_at';

/** Courses where the current user is a member with the given role (RLS limits rows further). */
export async function listMyCourses(
  userId: string,
  role: 'teacher' | 'student',
): Promise<Course[]> {
  const { data, error } = await client()
    .from('courses')
    .select(`${COURSE_COLUMNS}, course_members!inner(user_id, member_role)`)
    .eq('course_members.user_id', userId)
    .eq('course_members.member_role', role)
    .order('academic_year', { ascending: false })
    .order('term', { ascending: false })
    .order('code')
    .limit(100);
  if (error) throw error;
  return z.array(courseSchema.passthrough()).parse(data).map(toCourse);
}

export async function getCourse(courseId: string): Promise<Course | null> {
  const { data, error } = await client()
    .from('courses')
    .select(COURSE_COLUMNS)
    .eq('id', courseId)
    .maybeSingle();
  if (error) throw error;
  return data ? toCourse(courseSchema.parse(data)) : null;
}

export async function createCourse(userId: string, values: CourseFormValues): Promise<string> {
  const { data, error } = await client()
    .from('courses')
    .insert({
      code: values.code,
      name: values.name,
      level: values.level,
      classroom: values.classroom,
      term: values.term,
      academic_year: values.academicYear,
      weeks: values.weeks,
      description: values.description || null,
      created_by: userId,
    })
    .select('id')
    .single();
  if (error) throw error;
  return z.object({ id: z.string() }).parse(data).id;
}

export async function setCourseStatus(courseId: string, status: CourseStatus): Promise<void> {
  const { error } = await client().from('courses').update({ status }).eq('id', courseId);
  if (error) throw error;
}

export async function cloneCourse(
  courseId: string,
  term: number,
  academicYear: number,
  classroom: string,
) {
  const { data, error } = await client().rpc('clone_course', {
    _source_id: courseId,
    _term: term,
    _academic_year: academicYear,
    _classroom: classroom,
  });
  if (error) throw error;
  return z.string().parse(data);
}

const codeSchema = z.object({
  id: z.string(),
  code: z.string(),
  expires_at: z.string().nullable(),
  max_uses: z.number().nullable(),
  uses: z.number(),
  is_active: z.boolean(),
  created_at: z.string(),
});
export type EnrollmentCode = z.infer<typeof codeSchema>;

export async function listEnrollmentCodes(courseId: string): Promise<EnrollmentCode[]> {
  const { data, error } = await client()
    .from('enrollment_codes')
    .select('id, code, expires_at, max_uses, uses, is_active, created_at')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return z.array(codeSchema).parse(data);
}

export async function createEnrollmentCode(
  courseId: string,
  expiresAt: string | null,
  maxUses: number | null,
) {
  const { error } = await client().rpc('create_enrollment_code', {
    _course_id: courseId,
    _expires_at: expiresAt,
    _max_uses: maxUses,
  });
  if (error) throw error;
}

export async function deactivateEnrollmentCode(codeId: string): Promise<void> {
  const { error } = await client()
    .from('enrollment_codes')
    .update({ is_active: false })
    .eq('id', codeId);
  if (error) throw error;
}

export async function joinCourse(code: string): Promise<string> {
  const { data, error } = await client().rpc('join_course_by_code', { _code: code });
  if (error) throw error;
  return z.string().parse(data);
}

export async function countUnits(courseId: string): Promise<number> {
  const { count, error } = await client()
    .from('learning_units')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId);
  if (error) throw error;
  return count ?? 0;
}

export function courseErrorMessage(error: unknown): string {
  const e = error as { message?: string; code?: string } | null;
  const message = e?.message ?? '';
  if (message.includes('CQ_INVALID_CODE')) return 'รหัสไม่ถูกต้อง หมดอายุ หรือถูกใช้ครบแล้ว';
  if (message.includes('CQ_COURSE_ARCHIVED')) return 'รายวิชานี้ถูกเก็บถาวรแล้ว';
  if (message.includes('CQ_FORBIDDEN')) return 'คุณไม่มีสิทธิ์ทำรายการนี้';
  if (e?.code === '23505') return 'มีรายวิชารหัสนี้ในภาคเรียนและห้องเรียนเดียวกันแล้ว';
  return 'ทำรายการไม่สำเร็จ กรุณาลองใหม่';
}

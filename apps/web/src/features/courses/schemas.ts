import { z } from 'zod';

export const courseStatusEnum = z.enum(['draft', 'published', 'archived']);
export const courseLevelEnum = z.enum(['pvc', 'pvs']);
export type CourseStatus = z.infer<typeof courseStatusEnum>;
export type CourseLevel = z.infer<typeof courseLevelEnum>;

export const courseLevelLabels: Record<CourseLevel, string> = { pvc: 'ปวช.', pvs: 'ปวส.' };
export const courseStatusLabels: Record<CourseStatus, string> = {
  draft: 'ฉบับร่าง',
  published: 'เผยแพร่',
  archived: 'เก็บถาวร',
};

/** Current Thai academic year (พ.ศ.) and term in Asia/Bangkok: term 1 = May–Oct, term 2 = Nov–Mar. */
export function currentAcademicTerm(now = new Date()): { academicYear: number; term: 1 | 2 } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  if (month >= 5 && month <= 10) return { academicYear: year + 543, term: 1 };
  return { academicYear: (month >= 11 ? year : year - 1) + 543, term: 2 };
}

export const courseFormSchema = z.object({
  code: z.string().trim().min(1, 'กรุณากรอกรหัสวิชา').max(32, 'ไม่เกิน 32 ตัวอักษร'),
  name: z.string().trim().min(1, 'กรุณากรอกชื่อรายวิชา').max(200, 'ไม่เกิน 200 ตัวอักษร'),
  level: courseLevelEnum,
  classroom: z.string().trim().max(60, 'ไม่เกิน 60 ตัวอักษร'),
  term: z.coerce.number().int().min(1).max(3),
  academicYear: z.coerce.number().int().min(2500, 'ใช้ปี พ.ศ.').max(2700, 'ใช้ปี พ.ศ.'),
  weeks: z.coerce.number().int().min(1, 'อย่างน้อย 1 สัปดาห์').max(40, 'ไม่เกิน 40 สัปดาห์'),
  description: z.string().trim().max(5000, 'ไม่เกิน 5,000 ตัวอักษร'),
});
export type CourseFormInput = z.input<typeof courseFormSchema>;
export type CourseFormValues = z.output<typeof courseFormSchema>;

export const joinCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6,12}$/, 'รหัสต้องเป็นตัวอักษรภาษาอังกฤษหรือตัวเลข 6–12 ตัว'),
});

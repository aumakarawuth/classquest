import { z } from 'zod';
import { questStages } from '@/features/learning/resources';

export const questTypes = ['main', 'side', 'daily', 'weekly', 'challenge', 'boss'] as const;
export type QuestType = (typeof questTypes)[number];
export const submitModes = ['text', 'url', 'file', 'classroom'] as const;
export type SubmitMode = (typeof submitModes)[number];
export type SubmissionStatus = 'submitted' | 'needs_revision' | 'approved';

export const questTypeLabels: Record<QuestType, string> = {
  main: 'Main Quest',
  side: 'Side Quest',
  daily: 'Daily Quest',
  weekly: 'Weekly Quest',
  challenge: 'Challenge',
  boss: 'Boss Quest',
};
/** Badge styles per quest type (DESIGN_SYSTEM.md). Text uses foreground for AA contrast. */
export const questTypeTone: Record<QuestType, string> = {
  main: 'bg-primary/15 text-foreground',
  side: 'bg-secondary/15 text-foreground',
  daily: 'bg-success/15 text-foreground',
  weekly: 'bg-secondary/10 text-foreground',
  challenge: 'bg-warning/25 text-foreground',
  boss: 'xp-gradient text-white',
};
export const submitModeLabels: Record<SubmitMode, string> = {
  text: 'พิมพ์คำตอบ',
  url: 'ส่งลิงก์',
  file: 'อัปโหลดไฟล์ (≤ 2 MB)',
  classroom: 'ส่งใน Google Classroom',
};

export type QuestState =
  'available' | 'locked' | 'submitted' | 'needs_revision' | 'approved' | 'closed';
export const questStateLabels: Record<QuestState, string> = {
  available: 'พร้อมทำ',
  locked: 'ล็อกอยู่',
  submitted: 'รอครูตรวจ',
  needs_revision: 'ต้องแก้ไข',
  approved: 'ผ่านแล้ว',
  closed: 'ปิดรับงาน',
};

export interface QuestStateInput {
  dueAt: string | null;
  allowLate: boolean;
  maxAttempts: number;
  prerequisiteIds: string[];
  /** latest submission of this student, if any */
  latest: { status: SubmissionStatus; attemptNo: number } | null;
}

/** Display state for a student; mirrors the checks in submit_quest(). */
export function questState(
  q: QuestStateInput,
  approvedQuestIds: ReadonlySet<string>,
  now: number,
): QuestState {
  if (q.latest?.status === 'approved') return 'approved';
  if (q.latest?.status === 'submitted') return 'submitted';
  if (q.prerequisiteIds.some((id) => !approvedQuestIds.has(id))) return 'locked';
  const pastDue = q.dueAt !== null && new Date(q.dueAt).getTime() < now;
  if (pastDue && !q.allowLate) return 'closed';
  if (q.latest?.status === 'needs_revision') {
    return q.latest.attemptNo >= q.maxAttempts ? 'closed' : 'needs_revision';
  }
  return 'available';
}

export const questFormSchema = z
  .object({
    title: z.string().trim().min(1, 'กรุณากรอกชื่อภารกิจ').max(200, 'ไม่เกิน 200 ตัวอักษร'),
    type: z.enum(questTypes),
    unitId: z.string(),
    questStage: z.enum([...questStages, '']),
    descriptionMd: z.string().max(20000, 'ไม่เกิน 20,000 ตัวอักษร'),
    objectives: z.string().max(5000, 'ไม่เกิน 5,000 ตัวอักษร'),
    difficulty: z.coerce.number().int().min(1).max(5),
    maxScore: z.coerce.number().min(0, 'ต้องไม่ติดลบ').max(1000, 'ไม่เกิน 1,000'),
    xpReward: z.coerce.number().int().min(0, 'ต้องไม่ติดลบ').max(10000, 'ไม่เกิน 10,000'),
    dueAt: z.string(),
    allowLate: z.boolean(),
    submitModes: z.array(z.enum(submitModes)).min(1, 'เลือกวิธีส่งอย่างน้อย 1 วิธี'),
    classroomUrl: z.string().trim(),
    maxAttempts: z.coerce.number().int().min(1, 'อย่างน้อย 1 ครั้ง').max(20, 'ไม่เกิน 20 ครั้ง'),
    prerequisiteIds: z.array(z.string()),
    published: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (
      v.submitModes.includes('classroom') &&
      !/^https:\/\/classroom\.google\.com\//.test(v.classroomUrl)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['classroomUrl'],
        message: 'กรอกลิงก์งานใน Google Classroom (https://classroom.google.com/...)',
      });
    }
  });
export type QuestFormInput = z.input<typeof questFormSchema>;
export type QuestFormValues = z.output<typeof questFormSchema>;

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const ALLOWED_FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

/** Client-side pre-check; the Storage bucket enforces the same limits server-side. */
export function validateSubmissionFile(file: { size: number; type: string }): string | null {
  if (!ALLOWED_FILE_TYPES.includes(file.type)) return 'รองรับเฉพาะไฟล์ PNG, JPEG, WebP หรือ PDF';
  if (file.size > MAX_FILE_BYTES)
    return 'ไฟล์ต้องมีขนาดไม่เกิน 2 MB (งานขนาดใหญ่ให้ส่งเป็นลิงก์ Google Drive)';
  return null;
}

/** Datetime-local input value (Bangkok) ⇄ ISO string. Bangkok has no DST, so a fixed +07:00 is exact. */
export function bangkokLocalToIso(local: string): string | null {
  return local ? new Date(`${local}:00+07:00`).toISOString() : null;
}
export function isoToBangkokLocal(iso: string | null): string {
  if (!iso) return '';
  const shifted = new Date(new Date(iso).getTime() + 7 * 3600_000);
  return shifted.toISOString().slice(0, 16);
}

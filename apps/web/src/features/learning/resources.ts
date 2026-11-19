import {
  Code2,
  ExternalLink,
  FileText,
  FlaskConical,
  HardDrive,
  Image,
  MonitorPlay,
  Presentation,
  Puzzle,
  Type,
  SquarePlay,
  type LucideIcon,
} from 'lucide-react';
import { z } from 'zod';

export const resourceTypes = [
  'text',
  'image',
  'video',
  'pdf',
  'drive',
  'slides',
  'youtube',
  'code',
  'external',
  'interactive',
  'lab',
] as const;
export type ResourceType = (typeof resourceTypes)[number];

interface ResourceMeta {
  label: string;
  icon: LucideIcon;
  /** what the teacher fills in */
  input: 'url' | 'content';
  hint: string;
  /** allowed hosts for URL types (empty = any https host) */
  hosts?: string[];
}

export const resourceMeta: Record<ResourceType, ResourceMeta> = {
  text: { label: 'ข้อความ', icon: Type, input: 'content', hint: 'ข้อความเพิ่มเติม (รองรับ Markdown)' },
  image: {
    label: 'รูปภาพ',
    icon: Image,
    input: 'url',
    hint: 'ลิงก์รูปภาพ https (การอัปโหลดไฟล์จะเพิ่มภายหลัง)',
  },
  video: { label: 'วิดีโอ', icon: MonitorPlay, input: 'url', hint: 'ลิงก์วิดีโอจากบริการภายนอก' },
  pdf: { label: 'PDF', icon: FileText, input: 'url', hint: 'ลิงก์ไฟล์ PDF (แนะนำ Google Drive)' },
  drive: {
    label: 'Google Drive',
    icon: HardDrive,
    input: 'url',
    hint: 'ลิงก์ไฟล์หรือโฟลเดอร์ Google Drive ที่แชร์ให้นักเรียนแล้ว',
    hosts: ['drive.google.com', 'docs.google.com'],
  },
  slides: {
    label: 'Google Slides',
    icon: Presentation,
    input: 'url',
    hint: 'ลิงก์ Google Slides',
    hosts: ['docs.google.com'],
  },
  youtube: {
    label: 'YouTube',
    icon: SquarePlay,
    input: 'url',
    hint: 'ลิงก์วิดีโอ YouTube',
    hosts: ['www.youtube.com', 'youtube.com', 'm.youtube.com', 'youtu.be'],
  },
  code: { label: 'ตัวอย่างโค้ด', icon: Code2, input: 'content', hint: 'วางโค้ดตัวอย่าง' },
  external: { label: 'เว็บไซต์ภายนอก', icon: ExternalLink, input: 'url', hint: 'ลิงก์เว็บไซต์ https' },
  interactive: {
    label: 'กิจกรรมเชิงโต้ตอบ',
    icon: Puzzle,
    input: 'url',
    hint: 'ลิงก์กิจกรรม เช่น แบบฝึกออนไลน์',
  },
  lab: {
    label: 'Virtual Lab',
    icon: FlaskConical,
    input: 'url',
    hint: 'ลิงก์โปรเจกต์ Wokwi (รายละเอียดการทดลองเต็มรูปแบบอยู่ในเมนู Virtual Lab)',
    hosts: ['wokwi.com'],
  },
};

export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null;
    if (u.pathname.startsWith('/embed/') || u.pathname.startsWith('/shorts/'))
      return u.pathname.split('/')[2] ?? null;
    return u.searchParams.get('v');
  } catch {
    return null;
  }
}

export const resourceFormSchema = z
  .object({
    type: z.enum(resourceTypes),
    title: z.string().trim().max(200, 'ไม่เกิน 200 ตัวอักษร'),
    url: z.string().trim(),
    content: z.string().max(20000, 'ไม่เกิน 20,000 ตัวอักษร'),
  })
  .superRefine((v, ctx) => {
    const meta = resourceMeta[v.type];
    if (meta.input === 'content') {
      if (!v.content.trim())
        ctx.addIssue({ code: 'custom', path: ['content'], message: 'กรุณากรอกเนื้อหา' });
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(v.url);
    } catch {
      ctx.addIssue({ code: 'custom', path: ['url'], message: 'กรุณากรอกลิงก์ที่ถูกต้อง' });
      return;
    }
    if (parsed.protocol !== 'https:') {
      ctx.addIssue({ code: 'custom', path: ['url'], message: 'ลิงก์ต้องขึ้นต้นด้วย https://' });
    } else if (meta.hosts && !meta.hosts.includes(parsed.hostname)) {
      ctx.addIssue({ code: 'custom', path: ['url'], message: `ลิงก์ต้องมาจาก ${meta.hosts[0]}` });
    } else if (v.type === 'youtube' && !youtubeId(v.url)) {
      ctx.addIssue({ code: 'custom', path: ['url'], message: 'ไม่พบรหัสวิดีโอ YouTube ในลิงก์' });
    }
  });
export type ResourceFormValues = z.infer<typeof resourceFormSchema>;

export const questStages = ['question', 'understand', 'experiment', 'solve', 'transfer'] as const;
export type QuestStage = (typeof questStages)[number];
export const questStageLabels: Record<QuestStage, string> = {
  question: 'Q · ตั้งคำถาม',
  understand: 'U · ทำความเข้าใจ',
  experiment: 'E · ทดลอง',
  solve: 'S · แก้ปัญหา',
  transfer: 'T · ถ่ายทอด',
};

/** Move item at index by delta, returning a new array (or the same one if out of range). */
export function moveItem<T>(items: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target] as T, next[index] as T];
  return next;
}

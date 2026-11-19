import {
  Award,
  Cpu,
  Crown,
  Flame,
  Lightbulb,
  Medal,
  Rocket,
  Star,
  Target,
  Trophy,
  Wifi,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { z } from 'zod';

export const badgeIcons = {
  award: Award,
  medal: Medal,
  trophy: Trophy,
  star: Star,
  zap: Zap,
  flame: Flame,
  rocket: Rocket,
  crown: Crown,
  cpu: Cpu,
  wifi: Wifi,
  lightbulb: Lightbulb,
  target: Target,
} satisfies Record<string, LucideIcon>;
export type BadgeIcon = keyof typeof badgeIcons;
export const badgeIconNames = Object.keys(badgeIcons) as BadgeIcon[];

export const ruleTypes = [
  'lessons_completed',
  'quests_approved',
  'boss_approved',
  'level_reached',
] as const;
export type RuleType = (typeof ruleTypes)[number];
export const ruleSchema = z.object({
  type: z.enum(ruleTypes),
  count: z.number().int().min(1).max(1000).optional(),
});
export type BadgeRule = z.infer<typeof ruleSchema>;

export function describeRule(rule: BadgeRule | null): string {
  if (!rule) return 'ครูเป็นผู้มอบ';
  const n = rule.count ?? 1;
  switch (rule.type) {
    case 'lessons_completed':
      return `เรียนจบ ${n} บทเรียน`;
    case 'quests_approved':
      return `ผ่าน ${n} ภารกิจ`;
    case 'boss_approved':
      return n > 1 ? `ผ่าน Boss Quest ${n} ภารกิจ` : 'ผ่าน Boss Quest';
    case 'level_reached':
      return `ถึงเลเวล ${n}`;
  }
}

export const ruleTypeLabels: Record<RuleType | 'manual', string> = {
  manual: 'ครูมอบเอง',
  lessons_completed: 'เรียนจบครบจำนวนบทเรียน',
  quests_approved: 'ผ่านภารกิจครบจำนวน',
  boss_approved: 'ผ่าน Boss Quest',
  level_reached: 'ถึงเลเวลที่กำหนด',
};

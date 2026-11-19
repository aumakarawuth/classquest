import type { Roadmap } from '@/features/learning/roadmap';
import type { QuestState } from '@/features/quests/model';

export type NodeState = 'done' | 'next' | 'open' | 'waiting' | 'locked';

export interface PathNode {
  kind: 'lesson' | 'quest';
  id: string;
  title: string;
  state: NodeState;
  boss: boolean;
  href: string;
  xp?: number;
}
export interface PathSection {
  id: string;
  title: string;
  nodes: PathNode[];
}

export interface HubQuest {
  id: string;
  title: string;
  unitId: string | null;
  type: string;
  xp: number;
  position: number;
  state: QuestState;
}

const questNodeState: Record<QuestState, NodeState> = {
  approved: 'done',
  available: 'open',
  needs_revision: 'open',
  submitted: 'waiting',
  locked: 'locked',
  closed: 'locked',
};

/**
 * Turns the real roadmap + quest states into the game map: per unit, lessons first then quests.
 * The first playable node becomes "next" (the START marker). Nothing is invented.
 */
export function buildPath(courseId: string, roadmap: Roadmap, quests: HubQuest[]): PathSection[] {
  const sections: PathSection[] = roadmap.units.map((u) => ({
    id: u.id,
    title: u.title,
    nodes: [
      ...u.lessons.map((l): PathNode => ({
        kind: 'lesson',
        id: l.id,
        title: l.title,
        state: l.state === 'completed' ? 'done' : l.state === 'locked' ? 'locked' : 'open',
        boss: false,
        href: `/student/courses/${courseId}/lessons/${l.id}`,
      })),
      ...quests
        .filter((q) => q.unitId === u.id)
        .sort((a, b) => a.position - b.position)
        .map(toQuestNode),
    ],
  }));
  const unitIds = new Set(roadmap.units.map((u) => u.id));
  const extra = quests
    .filter((q) => !q.unitId || !unitIds.has(q.unitId))
    .sort((a, b) => a.position - b.position);
  if (extra.length)
    sections.push({ id: 'extra', title: 'ภารกิจเพิ่มเติม', nodes: extra.map(toQuestNode) });

  const visible = sections.filter((s) => s.nodes.length > 0);
  const first = visible.flatMap((s) => s.nodes).find((n) => n.state === 'open');
  if (first) first.state = 'next';
  return visible;
}

function toQuestNode(q: HubQuest): PathNode {
  return {
    kind: 'quest',
    id: q.id,
    title: q.title,
    state: questNodeState[q.state],
    boss: q.type === 'boss',
    href: `/student/quests/${q.id}`,
    xp: q.xp,
  };
}

export const nodeStateLabels: Record<NodeState, string> = {
  done: 'ผ่านแล้ว',
  next: 'ด่านถัดไป',
  open: 'พร้อมเล่น',
  waiting: 'รอครูตรวจ',
  locked: 'ยังล็อก',
};

/** Zig-zag horizontal offset (px) for the n-th node on the map. */
export function zigzag(index: number, amplitude = 56): number {
  const pattern = [0, 1, 1.6, 1, 0, -1, -1.6, -1];
  return Math.round((pattern[index % pattern.length] ?? 0) * amplitude);
}

/** Human Thai countdown for a deadline; `urgent` when less than 24 hours remain. */
export function formatDue(
  dueAt: string,
  now: number,
): { text: string; urgent: boolean; overdue: boolean } {
  const ms = new Date(dueAt).getTime() - now;
  if (ms <= 0) return { text: 'เลยกำหนดแล้ว', urgent: true, overdue: true };
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days >= 1)
    return {
      text: `เหลือ ${days} วัน${hours ? ` ${hours} ชม.` : ''}`,
      urgent: false,
      overdue: false,
    };
  if (hours >= 1) return { text: `เหลือ ${hours} ชม. ${mins} นาที`, urgent: true, overdue: false };
  return { text: `เหลือ ${Math.max(1, mins)} นาที`, urgent: true, overdue: false };
}

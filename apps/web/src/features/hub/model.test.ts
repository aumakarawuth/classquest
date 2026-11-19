import { buildRoadmap } from '@/features/learning/roadmap';
import { buildPath, formatDue, zigzag, type HubQuest } from './model';

const roadmap = buildRoadmap(
  [
    {
      id: 'u1',
      position: 1,
      title: 'สัปดาห์ 1',
      lessons: [
        {
          id: 'l1',
          title: 'IoT',
          position: 1,
          quest_stage: null,
          prerequisite_lesson_id: null,
          estimated_minutes: null,
        },
      ],
    },
    {
      id: 'u2',
      position: 2,
      title: 'สัปดาห์ 2',
      lessons: [
        {
          id: 'l2',
          title: 'Arduino',
          position: 1,
          quest_stage: null,
          prerequisite_lesson_id: 'l1',
          estimated_minutes: null,
        },
      ],
    },
  ],
  new Set(['l1']),
);
const q = (
  id: string,
  unitId: string | null,
  state: HubQuest['state'],
  type = 'main',
  position = 1,
): HubQuest => ({ id, title: id, unitId, type, xp: 100, position, state });

it('interleaves lessons and quests per unit and marks the first playable node as next', () => {
  const path = buildPath('c', roadmap, [
    q('m1', 'u1', 'approved'),
    q('m2', 'u2', 'locked'),
    q('boss', null, 'locked', 'boss'),
  ]);
  expect(path.map((s) => s.title)).toEqual(['สัปดาห์ 1', 'สัปดาห์ 2', 'ภารกิจเพิ่มเติม']);
  expect(path[0]?.nodes.map((n) => [n.id, n.state])).toEqual([
    ['l1', 'done'],
    ['m1', 'done'],
  ]);
  expect(path[1]?.nodes.map((n) => [n.id, n.state])).toEqual([
    ['l2', 'next'],
    ['m2', 'locked'],
  ]);
  expect(path[2]?.nodes[0]?.boss).toBe(true);
  expect(path[1]?.nodes[0]?.href).toBe('/student/courses/c/lessons/l2');
});

it('maps quest states and keeps only one next node', () => {
  const path = buildPath('c', roadmap, [
    q('a', 'u1', 'submitted'),
    q('b', 'u1', 'needs_revision', 'main', 2),
  ]);
  const nodes = path.flatMap((s) => s.nodes);
  expect(nodes.find((n) => n.id === 'a')?.state).toBe('waiting');
  expect(nodes.filter((n) => n.state === 'next')).toHaveLength(1);
});

it('formats countdowns in Thai', () => {
  const now = Date.parse('2026-11-19T10:00:00Z');
  expect(formatDue('2026-11-21T13:00:00Z', now)).toEqual({
    text: 'เหลือ 2 วัน 3 ชม.',
    urgent: false,
    overdue: false,
  });
  expect(formatDue('2026-11-19T12:25:00Z', now)).toEqual({
    text: 'เหลือ 2 ชม. 25 นาที',
    urgent: true,
    overdue: false,
  });
  expect(formatDue('2026-11-19T09:00:00Z', now).overdue).toBe(true);
});

it('zig-zags node offsets', () => {
  expect([0, 1, 2, 4, 6].map((i) => zigzag(i, 10))).toEqual([0, 10, 16, 0, -16]);
});

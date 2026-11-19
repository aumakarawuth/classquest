import { buildRoadmap, type RoadmapUnitInput } from './roadmap';

const lesson = (
  id: string,
  position: number,
  pre: string | null = null,
  stage: 'question' | 'solve' | null = null,
) => ({
  id,
  title: id.toUpperCase(),
  position,
  quest_stage: stage,
  prerequisite_lesson_id: pre,
  estimated_minutes: null,
});

const units: RoadmapUnitInput[] = [
  { id: 'u2', position: 2, title: 'สัปดาห์ 2', lessons: [lesson('c', 1, 'b', 'solve')] },
  {
    id: 'u1',
    position: 1,
    title: 'สัปดาห์ 1',
    lessons: [lesson('b', 2, 'a'), lesson('a', 1, null, 'question')],
  },
];

it('orders units and lessons, computes lock state and next lesson', () => {
  const r = buildRoadmap(units, new Set());
  expect(r.sequence.map((l) => l.id)).toEqual(['a', 'b', 'c']);
  expect(r.sequence.map((l) => l.state)).toEqual(['available', 'locked', 'locked']);
  expect(r.sequence[1]?.lockedBy).toBe('A');
  expect(r.next?.id).toBe('a');
  expect(r.percent).toBe(0);
});

it('unlocks after prerequisites and tracks QUEST stages', () => {
  const r = buildRoadmap(units, new Set(['a', 'b']));
  expect(r.sequence.map((l) => l.state)).toEqual(['completed', 'completed', 'available']);
  expect(r.percent).toBe(67);
  expect(r.stages.question).toEqual({ total: 1, completed: 1 });
  expect(r.stages.solve).toEqual({ total: 1, completed: 0 });
  expect(r.units[0]?.completed).toBe(2);
});

it('does not lock on a prerequisite the student cannot see', () => {
  const r = buildRoadmap(
    [{ id: 'u', position: 1, title: 'x', lessons: [lesson('z', 1, 'hidden')] }],
    new Set(),
  );
  expect(r.sequence[0]?.state).toBe('available');
});

import type { QuestStage } from './resources';
import { questStages } from './resources';

export type LessonState = 'completed' | 'available' | 'locked';

export interface RoadmapLessonInput {
  id: string;
  title: string;
  position: number;
  quest_stage: QuestStage | null;
  prerequisite_lesson_id: string | null;
  estimated_minutes: number | null;
}
export interface RoadmapUnitInput {
  id: string;
  position: number;
  title: string;
  lessons: RoadmapLessonInput[];
}

export interface RoadmapLesson extends RoadmapLessonInput {
  state: LessonState;
  /** title of the prerequisite when locked */
  lockedBy: string | null;
}
export interface RoadmapUnit extends Omit<RoadmapUnitInput, 'lessons'> {
  lessons: RoadmapLesson[];
  completed: number;
}
export interface Roadmap {
  units: RoadmapUnit[];
  total: number;
  completed: number;
  percent: number;
  stages: Record<QuestStage, { total: number; completed: number }>;
  /** first lesson the student can continue with */
  next: RoadmapLesson | null;
  /** ordered list of visible lessons (for prev/next navigation) */
  sequence: RoadmapLesson[];
}

/**
 * Display-only unlock state. The server enforces the same rule in complete_lesson().
 * A prerequisite the student cannot see (unpublished) does not lock the lesson.
 */
export function buildRoadmap(
  units: RoadmapUnitInput[],
  completedIds: ReadonlySet<string>,
): Roadmap {
  const titles = new Map(units.flatMap((u) => u.lessons.map((l) => [l.id, l.title] as const)));
  const stages = Object.fromEntries(
    questStages.map((s) => [s, { total: 0, completed: 0 }]),
  ) as Roadmap['stages'];
  const sequence: RoadmapLesson[] = [];

  const builtUnits = [...units]
    .sort((a, b) => a.position - b.position)
    .map((unit) => {
      const lessons = [...unit.lessons]
        .sort((a, b) => a.position - b.position)
        .map((lesson): RoadmapLesson => {
          const done = completedIds.has(lesson.id);
          const pre = lesson.prerequisite_lesson_id;
          const locked = !done && !!pre && titles.has(pre) && !completedIds.has(pre);
          if (lesson.quest_stage) {
            stages[lesson.quest_stage].total += 1;
            if (done) stages[lesson.quest_stage].completed += 1;
          }
          const result: RoadmapLesson = {
            ...lesson,
            state: done ? 'completed' : locked ? 'locked' : 'available',
            lockedBy: locked && pre ? (titles.get(pre) ?? null) : null,
          };
          sequence.push(result);
          return result;
        });
      return { ...unit, lessons, completed: lessons.filter((l) => l.state === 'completed').length };
    });

  const total = sequence.length;
  const completed = sequence.filter((l) => l.state === 'completed').length;
  return {
    units: builtUnits,
    total,
    completed,
    percent: total ? Math.round((completed / total) * 100) : 0,
    stages,
    next: sequence.find((l) => l.state === 'available') ?? null,
    sequence,
  };
}

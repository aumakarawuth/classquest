import type { DashboardStudent } from './api';
import { segmentOf } from './segments';

const st = (p: Partial<DashboardStudent>): DashboardStudent => ({
  user_id: 'u',
  display_name: 'A',
  student_code: null,
  last_active: null,
  lessons_done: 0,
  quests_approved: 0,
  needs_revision: 0,
  avg_quest_pct: null,
  avg_quiz_pct: null,
  xp: 0,
  competencies_developing: 0,
  flags: [],
  ...p,
});

it('segments students from RPC values', () => {
  expect(segmentOf(st({ flags: ['low_quiz'], avg_quest_pct: 95 }))).toBe('needs_help');
  expect(segmentOf(st({ avg_quest_pct: 80 }))).toBe('excelling');
  expect(segmentOf(st({ avg_quest_pct: 60 }))).toBe('on_track');
  expect(segmentOf(st({}))).toBe('on_track');
});

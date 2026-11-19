import type { Dashboard, DashboardStudent } from './api';

export type Segment = 'excelling' | 'on_track' | 'needs_help';
export const segmentLabels: Record<Segment, string> = {
  excelling: 'ทำได้ดีมาก',
  on_track: 'ตามแผน',
  needs_help: 'ต้องช่วยเหลือ',
};
export const segmentColors: Record<Segment, string> = {
  excelling: 'var(--success)',
  on_track: 'var(--primary)',
  needs_help: 'var(--warning)',
};

/**
 * Groups students using only the dashboard RPC output.
 * needs_help = any support flag; excelling = no flags and avg quest score >= 80%.
 */
export function segmentOf(s: DashboardStudent): Segment {
  if (s.flags.length) return 'needs_help';
  if ((s.avg_quest_pct ?? 0) >= 80) return 'excelling';
  return 'on_track';
}

export function summarize(d: Dashboard) {
  const counts: Record<Segment, number> = { excelling: 0, on_track: 0, needs_help: 0 };
  for (const s of d.students) counts[segmentOf(s)]++;
  const score = (s: DashboardStudent) => (s.avg_quest_pct ?? 0) * 1000 + s.xp;
  const top = d.students
    .filter((s) => segmentOf(s) === 'excelling')
    .sort((a, b) => score(b) - score(a))
    .slice(0, 5);
  const struggling = d.students
    .filter((s) => segmentOf(s) === 'needs_help')
    .sort(
      (a, b) =>
        b.flags.length - a.flags.length || a.display_name.localeCompare(b.display_name, 'th'),
    )
    .slice(0, 5);
  return { counts, top, struggling };
}

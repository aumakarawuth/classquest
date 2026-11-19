import { z } from 'zod';
import { supabase } from '@/lib/supabase';

const rowSchema = z.object({
  student: z.string(),
  pre_percent: z.coerce.number().nullable(),
  post_percent: z.coerce.number().nullable(),
  gain: z.coerce.number().nullable(),
  normalized_gain: z.coerce.number().nullable(),
});
export type PrePostRow = z.infer<typeof rowSchema>;

export async function getPrePostReport(
  courseId: string,
  preId: string,
  postId: string,
  anonymized: boolean,
) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.rpc('prepost_report', {
    _course_id: courseId,
    _pre_quiz_id: preId,
    _post_quiz_id: postId,
    _anonymized: anonymized,
  });
  if (error) throw error;
  return z.array(rowSchema).parse(data);
}

export interface PrePostSummary {
  enrolled: number;
  paired: number;
  meanPre: number | null;
  meanPost: number | null;
  meanGain: number | null;
  sdGain: number | null;
  /** paired t statistic (df = paired - 1); interpretation is left to the teacher/statistician */
  t: number | null;
  df: number | null;
  meanNormalizedGain: number | null;
  improved: number;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round = (x: number | null, d = 2) =>
  x === null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d;

/** Only students with BOTH tests are paired; nothing is imputed. */
export function summarize(rows: PrePostRow[]): PrePostSummary {
  const paired = rows.filter((r) => r.pre_percent !== null && r.post_percent !== null);
  const gains = paired.map((r) => (r.post_percent ?? 0) - (r.pre_percent ?? 0));
  const mg = mean(gains);
  const sd =
    gains.length > 1 && mg !== null
      ? Math.sqrt(gains.reduce((s, g) => s + (g - mg) ** 2, 0) / (gains.length - 1))
      : null;
  const t = sd && mg !== null && sd > 0 ? mg / (sd / Math.sqrt(gains.length)) : null;
  const ng = paired.map((r) => r.normalized_gain).filter((x): x is number => x !== null);
  return {
    enrolled: rows.length,
    paired: paired.length,
    meanPre: round(mean(paired.map((r) => r.pre_percent ?? 0))),
    meanPost: round(mean(paired.map((r) => r.post_percent ?? 0))),
    meanGain: round(mg),
    sdGain: round(sd),
    t: round(t, 3),
    df: paired.length > 1 ? paired.length - 1 : null,
    meanNormalizedGain: round(mean(ng), 3),
    improved: gains.filter((g) => g > 0).length,
  };
}

function csvCell(v: string | number | null): string {
  if (v === null) return '';
  const s = String(v);
  // neutralise spreadsheet formula injection and quote when needed
  const safe = /^[=+\-@]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: PrePostRow[]): string {
  const header = ['นักเรียน', 'ก่อนเรียน (%)', 'หลังเรียน (%)', 'ผลต่าง', 'Normalized gain'];
  const lines = rows.map((r) =>
    [r.student, r.pre_percent, r.post_percent, r.gain, r.normalized_gain].map(csvCell).join(','),
  );
  return '﻿' + [header.join(','), ...lines].join('\r\n'); // BOM: Excel opens Thai correctly
}

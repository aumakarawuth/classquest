import { CheckCircle2, CircleDashed, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { statusLabels, type CompetencyStatus } from '../api';

const tone: Record<CompetencyStatus, string> = {
  passed: 'bg-success/15',
  developing: 'bg-warning/25',
  not_assessed: 'bg-muted text-muted-foreground',
};
const icon = { passed: CheckCircle2, developing: TrendingUp, not_assessed: CircleDashed };

/** Status uses icon + text, never colour alone. */
export function StatusPill({
  status,
  percent,
}: {
  status: CompetencyStatus;
  percent?: number | null;
}) {
  const Icon = icon[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        tone[status],
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {statusLabels[status]}
      {percent !== null && percent !== undefined && (
        <span className="tabular-nums"> {Math.round(percent)}%</span>
      )}
    </span>
  );
}

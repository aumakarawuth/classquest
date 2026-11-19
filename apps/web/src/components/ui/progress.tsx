import { cn } from '@/lib/utils';

interface ProgressProps {
  value: number;
  max?: number;
  label: string;
  className?: string;
  barClassName?: string;
}

/** Accessible progress bar. Display only — values come from the backend. */
export function Progress({ value, max = 100, label, className, barClassName }: ProgressProps) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn('h-3 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      <div
        className={cn(
          'h-full rounded-full bg-primary transition-[width] duration-500',
          barClassName,
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

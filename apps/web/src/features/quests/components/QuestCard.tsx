import { CalendarClock, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { formatThaiDateTime } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import {
  questStateLabels,
  questTypeLabels,
  questTypeTone,
  type QuestState,
  type QuestType,
} from '../model';

interface QuestCardProps {
  to: string;
  title: string;
  type: QuestType;
  difficulty: number;
  xpReward: number;
  dueAt: string | null;
  subtitle?: string;
  state?: QuestState;
}

const stateTone: Record<QuestState, string> = {
  available: 'bg-primary/10',
  locked: 'bg-muted text-muted-foreground',
  submitted: 'bg-secondary/15',
  needs_revision: 'bg-warning/25',
  approved: 'bg-success/15',
  closed: 'bg-muted text-muted-foreground',
};

export function QuestCard({
  to,
  title,
  type,
  difficulty,
  xpReward,
  dueAt,
  subtitle,
  state,
}: QuestCardProps) {
  return (
    <Link to={to} className="block rounded-lg">
      <Card
        className={cn(
          'h-full space-y-3 transition-colors hover:border-primary/50',
          type === 'boss' && 'border-accent/60 shadow-[0_0_0_1px_var(--accent)]',
          state === 'locked' && 'opacity-75',
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', questTypeTone[type])}
          >
            {questTypeLabels[type]}
          </span>
          {state && (
            <span
              className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', stateTone[state])}
            >
              {questStateLabels[state]}
            </span>
          )}
        </div>
        <div>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          <h2 className="font-semibold">{title}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span aria-label={`ความยาก ${difficulty} จาก 5`} className="inline-flex gap-0.5">
            {Array.from({ length: 5 }, (_, i) => (
              <span
                key={i}
                aria-hidden
                className={cn('size-2 rounded-full', i < difficulty ? 'bg-primary' : 'bg-muted')}
              />
            ))}
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <Sparkles className="size-3.5 text-accent" aria-hidden />
            {xpReward.toLocaleString('th-TH')} XP
          </span>
          {dueAt && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3.5" aria-hidden />
              ส่ง {formatThaiDateTime(dueAt)}
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}

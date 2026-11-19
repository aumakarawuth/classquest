import { cn } from '@/lib/utils';
import type { Roadmap } from '../roadmap';
import { questStages } from '../resources';

const stageNames = {
  question: 'Question',
  understand: 'Understand',
  experiment: 'Experiment',
  solve: 'Solve',
  transfer: 'Transfer',
} as const;

/** Q-U-E-S-T stepper showing completed/total lessons per stage. */
export function QuestStageProgress({ stages }: { stages: Roadmap['stages'] }) {
  return (
    <ol className="grid grid-cols-5 gap-2" aria-label="ความคืบหน้าตามขั้นตอน QUEST">
      {questStages.map((stage) => {
        const { total, completed } = stages[stage];
        const done = total > 0 && completed === total;
        return (
          <li key={stage} className="flex flex-col items-center gap-1 text-center">
            <span
              className={cn(
                'inline-flex size-10 items-center justify-center rounded-lg text-lg font-bold',
                done
                  ? 'xp-gradient text-white'
                  : total
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground',
              )}
              aria-hidden
            >
              {stageNames[stage][0]}
            </span>
            <span className="text-xs font-medium">{stageNames[stage]}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              <span className="sr-only">{stageNames[stage]}: </span>
              {total ? `${completed}/${total}` : '–'}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

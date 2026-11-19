import { Progress } from '@/components/ui/progress';

interface XpBarProps {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
}

/** Shows level progress. Numbers are provided by the backend (XP is never computed client-side). */
export function XpBar({ level, xpIntoLevel, xpForNextLevel }: XpBarProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">เลเวล {level}</span>
        <span className="text-muted-foreground tabular-nums">
          {xpIntoLevel.toLocaleString('th-TH')} / {xpForNextLevel.toLocaleString('th-TH')} XP
        </span>
      </div>
      <Progress
        value={xpIntoLevel}
        max={xpForNextLevel}
        label={`ความคืบหน้าสู่เลเวล ${level + 1}`}
        barClassName="xp-gradient"
      />
    </div>
  );
}

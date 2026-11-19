import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { badgeIcons, describeRule, type BadgeIcon, type BadgeRule } from './badges';

interface BadgeTileProps {
  name: string;
  description: string;
  icon: BadgeIcon;
  rule: BadgeRule | null;
  xpBonus: number;
  earnedAt?: string | null;
  footer?: React.ReactNode;
  headingLevel?: 'h2' | 'h3';
}

export function BadgeTile({
  name,
  description,
  icon,
  rule,
  xpBonus,
  earnedAt,
  footer,
  headingLevel = 'h3',
}: BadgeTileProps) {
  const Icon = badgeIcons[icon];
  const Heading = headingLevel;
  const earned = !!earnedAt;
  return (
    <div
      className={cn(
        'flex h-full flex-col items-center gap-2 rounded-lg border bg-card p-4 text-center',
        !earned && 'bg-muted/40',
      )}
    >
      <span
        className={cn(
          'relative inline-flex size-14 items-center justify-center rounded-full',
          earned ? 'xp-gradient text-white shadow-md' : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="size-7" aria-hidden />
        {!earned && (
          <span className="absolute -right-1 -bottom-1 inline-flex size-6 items-center justify-center rounded-full border bg-card">
            <Lock className="size-3.5" aria-hidden />
          </span>
        )}
      </span>
      <Heading className="font-semibold">{name}</Heading>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <p className="text-xs text-muted-foreground">
        {earned ? 'ได้รับแล้ว' : describeRule(rule)}
        {xpBonus > 0 && ` · +${xpBonus} XP`}
      </p>
      {footer}
    </div>
  );
}

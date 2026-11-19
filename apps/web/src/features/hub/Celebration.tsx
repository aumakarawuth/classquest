import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Award, Sparkles, Star, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RewardDiff } from './celebration';

const COLORS = ['var(--primary)', 'var(--accent)', 'var(--warning)', 'var(--success)'];
const pieces = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i % 7) * 0.12,
  duration: 1.6 + (i % 5) * 0.25,
  color: COLORS[i % COLORS.length],
  rotate: (i * 47) % 360,
}));

/** Reward celebration. Confetti is decorative and disabled for reduced-motion users. */
export function Celebration({ diff, onClose }: { diff: RewardDiff | null; onClose: () => void }) {
  return (
    <AlertDialog.Root open={!!diff} onOpenChange={(o) => !o && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-slate-950/60" />
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-50 overflow-hidden motion-reduce:hidden"
        >
          {pieces.map((p, i) => (
            <span
              key={i}
              className="cq-confetti absolute -top-4 block h-3 w-2 rounded-sm"
              style={{
                left: `${p.left}%`,
                background: p.color,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                rotate: `${p.rotate}deg`,
              }}
            />
          ))}
        </div>
        {diff && (
          <AlertDialog.Content className="cq-pop fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-2xl border bg-card p-6 text-center shadow-2xl">
            <div className="xp-gradient mx-auto flex size-20 items-center justify-center rounded-full text-white shadow-lg">
              {diff.levelUp ? (
                <Trophy className="size-10" aria-hidden />
              ) : (
                <Sparkles className="size-10" aria-hidden />
              )}
            </div>
            <AlertDialog.Title className="text-2xl font-bold">
              {diff.levelUp ? `เลเวลอัป! Lv ${diff.levelUp}` : 'ยอดเยี่ยม!'}
            </AlertDialog.Title>
            <AlertDialog.Description asChild>
              <ul className="space-y-2 text-sm">
                {diff.xpGained > 0 && (
                  <li className="flex items-center justify-center gap-2">
                    <Star className="size-4 text-accent" aria-hidden />
                    ได้รับ{' '}
                    <strong className="tabular-nums">
                      +{diff.xpGained.toLocaleString('th-TH')} XP
                    </strong>
                  </li>
                )}
                {diff.newBadges > 0 && (
                  <li className="flex items-center justify-center gap-2">
                    <Award className="size-4 text-success" aria-hidden />
                    ได้ Badge ใหม่ <strong>{diff.newBadges}</strong> อัน
                  </li>
                )}
              </ul>
            </AlertDialog.Description>
            <AlertDialog.Action asChild>
              <Button className="w-full" onClick={onClose}>
                ลุยต่อ
              </Button>
            </AlertDialog.Action>
          </AlertDialog.Content>
        )}
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

import { BookOpen, Check, Clock, Crown, Lock, Swords } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { nodeStateLabels, zigzag, type PathNode, type PathSection } from './model';

const HEX = 'polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0% 50%)';

function NodeIcon({ node }: { node: PathNode }) {
  if (node.state === 'done') return <Check className="size-6" aria-hidden />;
  if (node.state === 'locked') return <Lock className="size-5" aria-hidden />;
  if (node.state === 'waiting') return <Clock className="size-5" aria-hidden />;
  if (node.boss) return <Crown className="size-7" aria-hidden />;
  return node.kind === 'lesson' ? (
    <BookOpen className="size-5" aria-hidden />
  ) : (
    <Swords className="size-5" aria-hidden />
  );
}

function Hex({ node, offset }: { node: PathNode; offset: number }) {
  const size = node.boss ? 'size-24' : 'size-16';
  const tone = {
    done: 'xp-gradient text-white',
    next: 'bg-primary text-primary-foreground',
    open: 'bg-primary/80 text-primary-foreground',
    waiting: 'bg-secondary text-secondary-foreground',
    locked: 'bg-muted text-muted-foreground',
  }[node.state];
  const label = `${node.kind === 'lesson' ? 'บทเรียน' : node.boss ? 'Boss Quest' : 'ภารกิจ'}: ${node.title} — ${nodeStateLabels[node.state]}${node.xp ? ` · ${node.xp} XP` : ''}`;
  const body = (
    <>
      {node.state === 'next' && (
        <span className="absolute -top-9 left-1/2 -translate-x-1/2 rounded-md bg-card px-2 py-1 text-xs font-bold tracking-wide text-primary shadow-md ring-1 ring-primary/40 motion-safe:animate-bounce">
          START
        </span>
      )}
      <span
        className={cn(
          'relative flex items-center justify-center transition-transform',
          size,
          tone,
          node.state !== 'locked' && 'group-hover:scale-110 group-focus-visible:scale-110',
          node.boss && node.state !== 'locked' && 'drop-shadow-[0_0_14px_var(--accent)]',
          node.state === 'next' && 'drop-shadow-[0_0_12px_var(--primary)]',
        )}
        style={{ clipPath: HEX }}
      >
        <NodeIcon node={node} />
      </span>
      <span
        className={cn(
          'mt-1 max-w-36 text-center text-xs leading-tight',
          node.state === 'locked' ? 'text-muted-foreground' : 'font-medium',
        )}
      >
        {node.title}
      </span>
    </>
  );
  const wrap = 'group relative flex flex-col items-center rounded-lg p-1 outline-offset-4';
  return (
    <li className="flex justify-center" style={{ transform: `translateX(${offset}px)` }}>
      {node.state === 'locked' ? (
        <div className={cn(wrap, 'cursor-not-allowed')} role="img" aria-label={label}>
          {body}
        </div>
      ) : (
        <Link to={node.href} className={wrap} aria-label={label}>
          {body}
        </Link>
      )}
    </li>
  );
}

/** Game-style map of the real learning path. Order = the order students should learn in. */
export function QuestMap({ sections }: { sections: PathSection[] }) {
  let index = 0;
  return (
    <nav aria-label="แผนที่การเรียนรู้" className="space-y-6">
      {sections.map((s) => (
        <section key={s.id} aria-label={s.title} className="space-y-4">
          <div className="flex items-center gap-3 text-xs font-semibold tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {s.title}
            <span className="h-px flex-1 bg-border" />
          </div>
          <ol className="space-y-6 pt-8">
            {s.nodes.map((n) => (
              <Hex key={`${n.kind}-${n.id}`} node={n} offset={zigzag(index++)} />
            ))}
          </ol>
        </section>
      ))}
    </nav>
  );
}

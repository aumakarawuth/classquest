import { Swords } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { cn } from '@/lib/utils';
import { QuestCard } from '../components/QuestCard';
import type { QuestState } from '../model';
import { useStudentQuests } from '../useStudentQuests';

const filters: {
  value: 'todo' | 'waiting' | 'done' | 'all';
  label: string;
  states: QuestState[];
}[] = [
  { value: 'todo', label: 'ต้องทำ', states: ['available', 'needs_revision'] },
  { value: 'waiting', label: 'รอตรวจ', states: ['submitted'] },
  { value: 'done', label: 'ผ่านแล้ว', states: ['approved'] },
  {
    value: 'all',
    label: 'ทั้งหมด',
    states: ['available', 'needs_revision', 'submitted', 'approved', 'locked', 'closed'],
  },
];

export default function QuestBoardPage() {
  const query = useStudentQuests();
  const [filter, setFilter] = useState<(typeof filters)[number]['value']>('todo');
  const active = filters.find((f) => f.value === filter) ?? filters[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ภารกิจ</h1>
        <p className="text-sm text-muted-foreground">ภารกิจจากทุกรายวิชาที่คุณเข้าร่วม</p>
      </div>
      <div
        role="tablist"
        aria-label="กรองภารกิจ"
        className="inline-flex flex-wrap gap-1 rounded-lg border bg-card p-1"
      >
        {filters.map((f) => {
          const count = query.data?.filter((x) => f.states.includes(x.state)).length;
          return (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                'min-h-9 rounded-md px-3 text-sm font-medium text-muted-foreground hover:text-foreground',
                filter === f.value &&
                  'bg-primary text-primary-foreground hover:text-primary-foreground',
              )}
            >
              {f.label}
              {count !== undefined && <span className="ml-1 tabular-nums">({count})</span>}
            </button>
          );
        })}
      </div>
      {query.isPending ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        (() => {
          const items = query.data.filter((x) => active?.states.includes(x.state));
          return items.length === 0 ? (
            <EmptyState
              icon={Swords}
              title={filter === 'todo' ? 'ไม่มีภารกิจที่ต้องทำตอนนี้' : 'ไม่มีภารกิจในหมวดนี้'}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map(({ quest, state }) => (
                <QuestCard
                  key={quest.id}
                  to={`/student/quests/${quest.id}`}
                  title={quest.title}
                  type={quest.type}
                  difficulty={quest.difficulty}
                  xpReward={quest.xp_reward}
                  dueAt={quest.due_at}
                  subtitle={`${quest.courses.code} ${quest.courses.name}`}
                  state={state}
                />
              ))}
            </div>
          );
        })()
      )}
    </div>
  );
}

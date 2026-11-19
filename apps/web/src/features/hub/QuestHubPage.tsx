import { useQuery } from '@tanstack/react-query';
import { Award, Flame, Hourglass, Star, Swords } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { XpBar } from '@/components/common/XpBar';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/features/auth/useAuth';
import { listMyCourses } from '@/features/courses/api';
import { getMyProgress } from '@/features/gamification/api';
import { listMyBadges } from '@/features/gamification/badgeApi';
import { useRoadmap } from '@/features/learning/useRoadmap';
import { questStateLabels } from '@/features/quests/model';
import { useStudentQuests } from '@/features/quests/useStudentQuests';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { buildPath, formatDue, type HubQuest } from './model';
import { QuestMap } from './QuestMap';

async function getStreak(courseId: string): Promise<number> {
  if (!supabase) return 0;
  const { data, error } = await supabase.rpc('my_learning_weeks', { _course_id: courseId });
  if (error) throw error;
  return (data as { current_streak?: number } | null)?.current_streak ?? 0;
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Star;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-card px-3 py-2 shadow-sm ring-1 ring-border">
      <Icon className={cn('size-5', tone)} aria-hidden />
      <div className="leading-tight">
        <p className="text-lg font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function QuestHubPage() {
  const { userId, account } = useAuth();
  const courses = useQuery({
    queryKey: ['courses', 'mine', 'student', userId],
    enabled: !!userId,
    queryFn: () => listMyCourses(userId ?? '', 'student'),
  });
  const [picked, setPicked] = useState<string | null>(null);
  const courseId = picked ?? courses.data?.[0]?.id ?? '';

  if (courses.isPending) return <PageSkeleton />;
  if (courses.isError) return <ErrorState onRetry={() => void courses.refetch()} />;
  if (!courses.data.length)
    return (
      <EmptyState
        icon={Swords}
        title="ยังไม่ได้เข้าร่วมรายวิชา"
        description="ใช้รหัสเข้าร่วมจากครูเพื่อเริ่มการผจญภัย"
        action={
          <Link to="/student/courses" className="text-primary underline">
            เข้าร่วมรายวิชา
          </Link>
        }
      />
    );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            สวัสดี {account?.displayName ?? ''} 👋
          </h1>
          <p className="text-sm text-muted-foreground">เลือกด่านถัดไปแล้วลุยกันเลย</p>
        </div>
        {courses.data.length > 1 && (
          <label className="text-sm">
            <span className="sr-only">เลือกรายวิชา</span>
            <select
              className="h-10 rounded-md border bg-background px-3"
              value={courseId}
              onChange={(e) => setPicked(e.target.value)}
            >
              {courses.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      <CourseHub key={courseId} courseId={courseId} />
    </div>
  );
}

function CourseHub({ courseId }: { courseId: string }) {
  const { userId } = useAuth();
  const roadmap = useRoadmap(courseId);
  const [now] = useState(() => Date.now());
  const quests = useStudentQuests();
  const progress = useQuery({
    queryKey: ['progress', courseId],
    queryFn: () => getMyProgress(courseId),
  });
  const streak = useQuery({
    queryKey: ['learning-weeks-streak', courseId],
    queryFn: () => getStreak(courseId),
  });
  const badges = useQuery({
    queryKey: ['badges', 'mine', userId],
    enabled: !!userId,
    queryFn: () => listMyBadges(userId ?? ''),
  });

  const courseQuests = useMemo(
    () => (quests.data ?? []).filter((r) => r.quest.course_id === courseId),
    [quests.data, courseId],
  );
  const sections = useMemo(() => {
    if (!roadmap.data) return [];
    const hq: HubQuest[] = courseQuests.map(({ quest, state }) => ({
      id: quest.id,
      title: quest.title,
      unitId: quest.unit_id,
      type: quest.type,
      xp: quest.xp_reward,
      position: quest.position,
      state,
    }));
    return buildPath(courseId, roadmap.data, hq);
  }, [roadmap.data, courseQuests, courseId]);

  if (roadmap.isPending || quests.isPending) return <PageSkeleton />;
  if (roadmap.isError || quests.isError)
    return (
      <ErrorState
        onRetry={() => {
          void roadmap.refetch();
          void quests.refetch();
        }}
      />
    );

  const p = progress.data;
  const floor = p?.level_floor ?? 0;
  const due = courseQuests
    .filter((r) => r.quest.due_at && (r.state === 'available' || r.state === 'needs_revision'))
    .slice(0, 5);
  const todo = courseQuests.filter((r) => r.state === 'available' || r.state === 'needs_revision');
  const courseBadges = (badges.data ?? []).filter((b) => b.course_id === courseId).length;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="สถานะผู้เล่น" role="group">
        <Stat
          icon={Flame}
          label="สัปดาห์ต่อเนื่อง"
          value={String(streak.data ?? 0)}
          tone="text-warning"
        />
        <Stat
          icon={Star}
          label="XP สะสม"
          value={(p?.xp ?? 0).toLocaleString('th-TH')}
          tone="text-accent"
        />
        <Stat
          icon={Swords}
          label={p?.level_title ?? 'เลเวล'}
          value={`Lv ${p?.level ?? 1}`}
          tone="text-primary"
        />
        <Stat icon={Award} label="Badge" value={String(courseBadges)} tone="text-success" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="overflow-hidden py-8">
          <h2 className="sr-only">แผนที่ด่าน</h2>
          <p className="mb-2 text-center text-sm text-muted-foreground">
            ความคืบหน้าบทเรียน {roadmap.data.completed}/{roadmap.data.total} ({roadmap.data.percent}%)
          </p>
          {sections.length ? (
            <QuestMap sections={sections} />
          ) : (
            <EmptyState icon={Swords} title="ยังไม่มีด่าน" description="ครูยังไม่ได้เผยแพร่บทเรียนหรือภารกิจ" />
          )}
        </Card>
        <aside className="space-y-4">
          <Card className="space-y-3">
            <h2 className="font-semibold">เลเวลของฉัน</h2>
            <XpBar
              level={p?.level ?? 1}
              xpIntoLevel={Math.max(0, (p?.xp ?? 0) - floor)}
              xpForNextLevel={Math.max(1, (p?.next_threshold ?? floor + 1) - floor)}
            />
          </Card>
          <Card className="space-y-3">
            <h2 className="flex items-center gap-2 font-semibold">
              <Hourglass className="size-4" aria-hidden />
              ใกล้ครบกำหนด
            </h2>
            {due.length ? (
              <ul className="space-y-2">
                {due.map(({ quest }) => {
                  const d = formatDue(quest.due_at ?? '', now);
                  return (
                    <li key={quest.id}>
                      <Link
                        to={`/student/quests/${quest.id}`}
                        className="flex justify-between gap-2 rounded-md p-2 text-sm hover:bg-muted"
                      >
                        <span className="truncate">{quest.title}</span>
                        <span
                          className={cn(
                            'shrink-0 tabular-nums',
                            d.urgent ? 'font-semibold text-destructive' : 'text-muted-foreground',
                          )}
                        >
                          {d.text}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">ไม่มีงานที่ใกล้ครบกำหนด</p>
            )}
          </Card>
          <Card className="space-y-3">
            <h2 className="font-semibold">ภารกิจที่รอคุณ</h2>
            {todo.length ? (
              <ul className="space-y-2">
                {todo.slice(0, 6).map(({ quest, state }) => (
                  <li key={quest.id}>
                    <Link
                      to={`/student/quests/${quest.id}`}
                      className="flex justify-between gap-2 rounded-md p-2 text-sm hover:bg-muted"
                    >
                      <span className="truncate">{quest.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {questStateLabels[state]} · {quest.xp_reward} XP
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">ทำภารกิจที่เปิดอยู่ครบแล้ว 🎉</p>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}

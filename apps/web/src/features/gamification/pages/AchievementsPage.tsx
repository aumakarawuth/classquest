import { useQuery } from '@tanstack/react-query';
import { Award } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/features/auth/useAuth';
import { listMyCourses } from '@/features/courses/api';
import { formatThaiDateTime } from '@/lib/datetime';
import { listBadges, listMyBadges } from '../badgeApi';
import { BadgeTile } from '../BadgeTile';

export default function AchievementsPage() {
  const { userId } = useAuth();
  const query = useQuery({
    queryKey: ['achievements', userId],
    enabled: !!userId,
    queryFn: async () => {
      const courses = await listMyCourses(userId ?? '', 'student');
      const [badges, earned] = await Promise.all([
        listBadges(courses.map((c) => c.id)),
        listMyBadges(userId ?? ''),
      ]);
      return { courses, badges, earned };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ความสำเร็จ</h1>
        <p className="text-sm text-muted-foreground">Badge ที่ได้รับและที่ยังรอปลดล็อกในแต่ละรายวิชา</p>
      </div>
      {query.isPending ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.data.courses.length === 0 ? (
        <EmptyState
          icon={Award}
          title="ยังไม่ได้เข้าร่วมรายวิชา"
          description="เข้าร่วมรายวิชาเพื่อเริ่มสะสม Badge"
        />
      ) : (
        query.data.courses.map((course) => {
          const badges = query.data.badges.filter(
            (b) => b.course_id === null || b.course_id === course.id,
          );
          const earned = new Map(
            query.data.earned
              .filter((e) => e.course_id === course.id)
              .map((e) => [e.badge_id, e.created_at]),
          );
          const visible = badges.filter((b) => b.active || earned.has(b.id));
          const sorted = [...visible].sort(
            (a, b) => Number(earned.has(b.id)) - Number(earned.has(a.id)),
          );
          return (
            <section key={course.id} aria-labelledby={`ach-${course.id}`} className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 id={`ach-${course.id}`} className="font-semibold">
                  {course.code} {course.name}
                </h2>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {earned.size}/{visible.length}
                </span>
              </div>
              <Card className="p-4">
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {sorted.map((b) => (
                    <li key={b.id}>
                      <BadgeTile
                        name={b.name}
                        description={b.description}
                        icon={b.icon}
                        rule={b.rule}
                        xpBonus={b.xp_bonus}
                        earnedAt={earned.get(b.id)}
                        footer={
                          earned.get(b.id) ? (
                            <time
                              className="text-xs text-muted-foreground"
                              dateTime={earned.get(b.id)}
                            >
                              {formatThaiDateTime(earned.get(b.id) ?? '')}
                            </time>
                          ) : null
                        }
                      />
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          );
        })
      )}
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { XpBar } from '@/components/common/XpBar';
import { Card } from '@/components/ui/card';
import { getMyProgress } from './api';

/** Level + XP for one course. Values come from my_course_progress() — never computed client-side. */
export function CourseXpCard({ courseId, title }: { courseId: string; title?: string }) {
  const query = useQuery({
    queryKey: ['progress', courseId],
    queryFn: () => getMyProgress(courseId),
  });
  const p = query.data;
  return (
    <Card className="space-y-3">
      <h2 className="flex items-center gap-2 font-semibold">
        <Trophy className="size-5 text-accent" aria-hidden />
        {title ?? 'ระดับและ XP'}
      </h2>
      {query.isPending ? (
        <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
      ) : query.isError || !p ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูล XP</p>
      ) : (
        <>
          <p className="text-3xl font-bold tabular-nums">
            {p.xp.toLocaleString('th-TH')}{' '}
            <span className="text-base font-medium text-muted-foreground">XP</span>
          </p>
          {p.level_title && <p className="text-sm font-medium text-accent">{p.level_title}</p>}
          {p.next_threshold !== null ? (
            <XpBar
              level={p.level ?? 1}
              xpIntoLevel={p.xp - (p.level_floor ?? 0)}
              xpForNextLevel={p.next_threshold - (p.level_floor ?? 0)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">เลเวล {p.level} — เลเวลสูงสุดแล้ว</p>
          )}
          <p className="text-xs text-muted-foreground">
            XP สะท้อนการลงมือเรียนรู้ และแยกจากคะแนนผลการเรียน
          </p>
        </>
      )}
    </Card>
  );
}

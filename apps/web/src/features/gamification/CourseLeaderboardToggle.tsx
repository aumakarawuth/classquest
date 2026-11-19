import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Medal } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { getLeaderboardStatus, setCourseLeaderboard } from './leaderboardApi';

export function CourseLeaderboardToggle({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: ['leaderboard', 'status', courseId],
    queryFn: () => getLeaderboardStatus(courseId),
  });
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => setCourseLeaderboard(courseId, enabled),
    onSuccess: (_, enabled) => {
      toast.success(enabled ? 'เปิด Leaderboard ของรายวิชาแล้ว' : 'ปิด Leaderboard แล้ว');
      void queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
    onError: () => toast.error('บันทึกไม่สำเร็จ'),
  });
  const s = status.data;
  return (
    <Card className="space-y-3">
      <h2 className="flex items-center gap-2 font-semibold">
        <Medal className="size-5 text-warning" aria-hidden />
        Leaderboard
      </h2>
      <label className="inline-flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={s?.course_enabled ?? false}
          disabled={!s || toggle.isPending}
          onChange={(e) => toggle.mutate(e.target.checked)}
          className="size-5 accent-[var(--primary)]"
        />
        เปิด Leaderboard ในรายวิชานี้
      </label>
      <p className="text-xs text-muted-foreground">
        นักเรียนต้องเลือกเข้าร่วมเอง แสดงเฉพาะชื่อเล่น เลเวล และ XP
        {s && !s.system_enabled && ' — ขณะนี้ผู้ดูแลระบบปิด Leaderboard ทั้งระบบ นักเรียนจะยังไม่เห็นจนกว่าจะเปิด'}
      </p>
    </Card>
  );
}

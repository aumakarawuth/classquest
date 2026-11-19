import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Medal } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { inputClass } from '@/components/ui/field-utils';
import { useAuth } from '@/features/auth/useAuth';
import { cn } from '@/lib/utils';
import {
  getLeaderboard,
  getLeaderboardStatus,
  getMyLeaderboardPrefs,
  updateMyLeaderboardPrefs,
} from './leaderboardApi';

/** Renders nothing unless the leaderboard is enabled system-wide and for this course. */
export function LeaderboardCard({ courseId }: { courseId: string }) {
  const status = useQuery({
    queryKey: ['leaderboard', 'status', courseId],
    queryFn: () => getLeaderboardStatus(courseId),
  });
  if (!status.data?.system_enabled || !status.data.course_enabled) return null;
  return <Board courseId={courseId} />;
}

function Board({ courseId }: { courseId: string }) {
  const { userId } = useAuth();
  const board = useQuery({
    queryKey: ['leaderboard', courseId],
    queryFn: () => getLeaderboard(courseId),
  });
  const prefs = useQuery({
    queryKey: ['leaderboard', 'prefs', userId],
    queryFn: () => getMyLeaderboardPrefs(userId ?? ''),
    enabled: !!userId,
  });

  return (
    <Card className="space-y-4 lg:col-span-3">
      <h2 className="flex items-center gap-2 font-semibold">
        <Medal className="size-5 text-warning" aria-hidden />
        Leaderboard
      </h2>
      <p className="text-xs text-muted-foreground">
        แสดงเฉพาะผู้ที่เลือกเข้าร่วม ด้วยชื่อเล่นและ XP เท่านั้น ไม่แสดงชื่อจริงหรือคะแนนผลการเรียน
      </p>
      {board.isPending ? (
        <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
      ) : board.isError ? (
        <p className="text-sm text-muted-foreground">โหลด Leaderboard ไม่สำเร็จ</p>
      ) : board.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีผู้เข้าร่วม</p>
      ) : (
        <ol className="divide-y rounded-lg border">
          {board.data.map((r) => (
            <li
              key={`${r.rank}-${r.nickname}-${r.is_me}`}
              className={cn(
                'flex items-center gap-3 px-3 py-2 text-sm',
                r.is_me && 'bg-primary/10 font-semibold',
              )}
            >
              <span className="w-8 text-center tabular-nums">{r.rank}</span>
              <span className="min-w-0 flex-1 truncate">
                {r.nickname}
                {r.is_me && ' (คุณ)'}
              </span>
              <span className="text-muted-foreground">Lv {r.level ?? 1}</span>
              <span className="w-20 text-right tabular-nums">
                {r.xp.toLocaleString('th-TH')} XP
              </span>
            </li>
          ))}
        </ol>
      )}
      {prefs.data && <Prefs key={String(prefs.dataUpdatedAt)} initial={prefs.data} />}
    </Card>
  );
}

function Prefs({ initial }: { initial: { nickname: string | null; leaderboard_opt_in: boolean } }) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [optIn, setOptIn] = useState(initial.leaderboard_opt_in);
  const [nickname, setNickname] = useState(initial.nickname ?? '');
  const save = useMutation({
    mutationFn: () => updateMyLeaderboardPrefs(userId ?? '', optIn, nickname),
    onSuccess: () => {
      toast.success(optIn ? 'เข้าร่วม Leaderboard แล้ว' : 'ซ่อนคุณจาก Leaderboard แล้ว');
      void queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
    onError: () => toast.error('บันทึกไม่สำเร็จ'),
  });
  return (
    <form
      className="flex flex-col gap-3 rounded-lg bg-muted/50 p-3 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <label className="inline-flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={optIn}
          onChange={(e) => setOptIn(e.target.checked)}
          className="size-5 accent-[var(--primary)]"
        />
        แสดงฉันใน Leaderboard
      </label>
      <div className="flex-1 space-y-1">
        <label htmlFor="lb-nickname" className="block text-xs text-muted-foreground">
          ชื่อเล่นที่แสดง (ไม่ควรใช้ชื่อจริง)
        </label>
        <input
          id="lb-nickname"
          value={nickname}
          maxLength={40}
          onChange={(e) => setNickname(e.target.value)}
          className={inputClass}
        />
      </div>
      <Button type="submit" variant="outline" disabled={save.isPending}>
        บันทึก
      </Button>
    </form>
  );
}

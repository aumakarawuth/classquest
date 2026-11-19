import { useQuery } from '@tanstack/react-query';
import { Flame } from 'lucide-react';
import { z } from 'zod';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const schema = z
  .object({
    total_weeks: z.number(),
    current_streak: z.number(),
    recent: z.array(z.object({ week_start: z.string(), active: z.boolean() })),
  })
  .nullable();

async function getWeeks(courseId: string) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.rpc('my_learning_weeks', { _course_id: courseId });
  if (error) throw error;
  return schema.parse(data);
}

/** Non-punitive weekly streak: one missed week is forgiven and nothing is ever deducted. */
export function LearningWeeksCard({ courseId }: { courseId: string }) {
  const q = useQuery({ queryKey: ['learning-weeks', courseId], queryFn: () => getWeeks(courseId) });
  const d = q.data;
  if (!d) return null;
  return (
    <Card className="space-y-3">
      <h2 className="flex items-center gap-2 font-semibold">
        <Flame className="size-5 text-warning" aria-hidden />
        สัปดาห์แห่งการเรียนรู้
      </h2>
      <p className="text-3xl font-bold tabular-nums">
        {d.current_streak}{' '}
        <span className="text-base font-medium text-muted-foreground">สัปดาห์ต่อเนื่อง</span>
      </p>
      <ol className="flex gap-1.5" aria-label="8 สัปดาห์ล่าสุด">
        {d.recent.map((w) => (
          <li
            key={w.week_start}
            className={cn('h-6 flex-1 rounded', w.active ? 'xp-gradient' : 'bg-muted')}
          >
            <span className="sr-only">
              สัปดาห์เริ่ม{' '}
              {new Date(`${w.week_start}T00:00:00+07:00`).toLocaleDateString('th-TH', {
                dateStyle: 'medium',
                timeZone: 'Asia/Bangkok',
              })}
              : {w.active ? 'มีการเรียนรู้' : 'ยังไม่มีการเรียนรู้'}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">
        เรียนรู้แล้วทั้งหมด {d.total_weeks} สัปดาห์ · ขาดได้ 1 สัปดาห์โดย streak ไม่หาย และไม่มีการหัก XP
      </p>
    </Card>
  );
}

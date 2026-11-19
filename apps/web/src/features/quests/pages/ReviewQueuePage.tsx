import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Card } from '@/components/ui/card';
import { formatThaiDateTime } from '@/lib/datetime';
import { listReviewQueue } from '../reviewApi';

export default function ReviewQueuePage() {
  const query = useQuery({ queryKey: ['reviews', 'queue'], queryFn: listReviewQueue });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ตรวจงาน</h1>
        <p className="text-sm text-muted-foreground">งานที่รอตรวจจากทุกรายวิชาที่คุณสอน เรียงจากส่งก่อน</p>
      </div>
      {query.isPending ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="ไม่มีงานรอตรวจ" description="งานที่นักเรียนส่งจะแสดงที่นี่" />
      ) : (
        <ol className="space-y-2">
          {query.data.map((item) => (
            <li key={item.id}>
              <Link to={`/teacher/reviews/${item.id}`} className="block rounded-lg">
                <Card className="flex flex-col gap-1 p-4 hover:border-primary/50 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.quests.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.profiles.display_name} · ครั้งที่ {item.attempt_no}
                      {item.is_late && ' · ส่งช้า'} · {item.courses.code}
                    </p>
                  </div>
                  <time
                    dateTime={item.submitted_at}
                    className="shrink-0 text-xs text-muted-foreground"
                  >
                    {formatThaiDateTime(item.submitted_at)}
                  </time>
                </Card>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

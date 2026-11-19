import { useQuery } from '@tanstack/react-query';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatThaiDateTime } from '@/lib/datetime';
import { cellStatus, getMatrix, listCompetencies, listEvidence, sourceLabels } from '../api';
import { StatusPill } from './StatusPill';

/** Individual competency report: status, latest % vs threshold, and the evidence trail. */
export function CompetencyReport({ courseId, userId }: { courseId: string; userId: string }) {
  const query = useQuery({
    queryKey: ['competency', 'report', courseId, userId],
    queryFn: async () => {
      const [competencies, cells, evidence] = await Promise.all([
        listCompetencies(courseId),
        getMatrix(courseId, userId),
        listEvidence(courseId, userId),
      ]);
      return { competencies, cells, evidence };
    },
  });
  if (query.isPending) return <PageSkeleton />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  const { competencies, cells, evidence } = query.data;
  if (!competencies.length)
    return <p className="text-sm text-muted-foreground">รายวิชานี้ยังไม่ได้กำหนดสมรรถนะ</p>;
  const passed = cells.filter((c) => c.passed).length;

  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <p className="text-sm font-medium">
          ผ่านแล้ว {passed} จาก {competencies.length} สมรรถนะ
        </p>
        <Progress
          value={passed}
          max={competencies.length}
          label="สัดส่วนสมรรถนะที่ผ่าน"
          barClassName="bg-success"
        />
      </Card>
      <ul className="space-y-3">
        {competencies.map((k) => {
          const cell = cells.find((c) => c.competency_id === k.id);
          const items = evidence.filter((e) => e.competency_id === k.id);
          return (
            <li key={k.id}>
              <Card className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">{k.code}</p>
                    <h3 className="font-semibold">{k.name}</h3>
                  </div>
                  <StatusPill status={cellStatus(cell)} percent={cell?.score_percent} />
                </div>
                <p className="text-xs text-muted-foreground">
                  เกณฑ์ผ่าน {k.pass_threshold}% · หลักฐาน {items.length} รายการ
                </p>
                {items.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-sm">ดูหลักฐาน</summary>
                    <ol className="mt-2 space-y-1 text-sm">
                      {items.map((e) => (
                        <li
                          key={e.id}
                          className="flex flex-wrap justify-between gap-2 rounded bg-muted/50 px-2 py-1"
                        >
                          <span>
                            {sourceLabels[e.source_type]} · {Math.round(e.score_percent)}%
                            {e.note && ` — ${e.note}`}
                          </span>
                          <time dateTime={e.created_at} className="text-xs text-muted-foreground">
                            {formatThaiDateTime(e.created_at)}
                          </time>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Grid3x3 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Card } from '@/components/ui/card';
import { cellStatus, getMatrix, listCompetencies } from '../api';
import { StatusPill } from '../components/StatusPill';

export default function CompetencyMatrixPage() {
  const { courseId = '' } = useParams();
  const query = useQuery({
    queryKey: ['competency', 'matrix', courseId],
    queryFn: async () => {
      const [competencies, cells] = await Promise.all([
        listCompetencies(courseId),
        getMatrix(courseId),
      ]);
      return { competencies, cells };
    },
  });

  return (
    <div className="space-y-6">
      <Link
        to={`/teacher/courses/${courseId}/competencies`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        สมรรถนะรายวิชา
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ตารางสมรรถนะ (Skill Matrix)</h1>
        <p className="text-sm text-muted-foreground">
          สถานะจากหลักฐานล่าสุดของนักเรียนแต่ละคน คลิกชื่อเพื่อดูรายงานรายบุคคลและบันทึกผลการประเมินเพิ่ม
        </p>
      </div>
      {query.isPending ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.data.competencies.length === 0 ? (
        <EmptyState icon={Grid3x3} title="ยังไม่ได้กำหนดสมรรถนะ" />
      ) : (
        (() => {
          const { competencies, cells } = query.data;
          const students = [...new Map(cells.map((c) => [c.user_id, c.display_name])).entries()];
          if (!students.length) return <EmptyState title="ยังไม่มีนักเรียนในรายวิชา" />;
          return (
            <>
              <Card className="grid gap-2 sm:grid-cols-3">
                {competencies.map((k) => {
                  const passed = cells.filter((c) => c.competency_id === k.id && c.passed).length;
                  return (
                    <p key={k.id} className="text-sm">
                      <span className="font-semibold">{k.code}</span> ผ่าน {passed}/{students.length}{' '}
                      คน
                    </p>
                  );
                })}
              </Card>
              <div className="overflow-x-auto rounded-lg border bg-card">
                <table className="w-full min-w-[40rem] text-sm">
                  <caption className="sr-only">สถานะสมรรถนะของนักเรียนแต่ละคน</caption>
                  <thead>
                    <tr className="border-b text-left">
                      <th scope="col" className="sticky left-0 bg-card p-3 font-semibold">
                        นักเรียน
                      </th>
                      {competencies.map((k) => (
                        <th key={k.id} scope="col" className="p-3 font-semibold" title={k.name}>
                          {k.code}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(([id, name]) => (
                      <tr key={id} className="border-b last:border-0">
                        <th scope="row" className="sticky left-0 bg-card p-3 text-left font-normal">
                          <Link
                            to={`/teacher/courses/${courseId}/competency/${id}`}
                            className="text-primary underline"
                          >
                            {name}
                          </Link>
                        </th>
                        {competencies.map((k) => {
                          const cell = cells.find(
                            (c) => c.user_id === id && c.competency_id === k.id,
                          );
                          return (
                            <td key={k.id} className="p-3">
                              <StatusPill status={cellStatus(cell)} percent={cell?.score_percent} />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          );
        })()
      )}
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { Download, GraduationCap } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Button } from '@/components/ui/button';
import { listQuizzes } from '@/features/assessment/api';
import { listCourseQuests } from '@/features/quests/api';
import { getGrades, listRoster, type GradeCell } from '../api';
import { CoursePicker } from '../CoursePicker';
import { defaultCourse, useTeacherCourses } from '../courseHooks';
import { downloadCsv, toCsv } from '../csv';

const show = (c: GradeCell | undefined) =>
  !c
    ? '–'
    : c.score === null
      ? c.status === 'needs_revision'
        ? 'แก้ไข'
        : 'ส่งแล้ว'
      : `${c.score}${c.max !== null ? `/${c.max}` : ''}`;

export default function GradebookPage() {
  const courses = useTeacherCourses();
  const [picked, setPicked] = useState('');
  const courseId = picked || defaultCourse(courses.data);
  if (courses.isPending) return <PageSkeleton />;
  if (courses.isError) return <ErrorState onRetry={() => void courses.refetch()} />;
  if (!courses.data.length) return <EmptyState icon={GraduationCap} title="ยังไม่มีรายวิชา" />;
  const course = courses.data.find((c) => c.id === courseId);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">สมุดคะแนน</h1>
        <p className="text-sm text-muted-foreground">
          คะแนนล่าสุดที่ครูตรวจแล้วของแต่ละภารกิจ และคะแนนแบบทดสอบครั้งล่าสุด ตามที่บันทึกในระบบ
        </p>
      </div>
      <CoursePicker courses={courses.data} value={courseId} onChange={setPicked} />
      <Grid
        key={courseId}
        courseId={courseId}
        fileName={`gradebook-${course?.code ?? 'course'}.csv`}
      />
    </div>
  );
}

function Grid({ courseId, fileName }: { courseId: string; fileName: string }) {
  const data = useQuery({
    queryKey: ['gradebook', courseId],
    queryFn: async () => {
      const [roster, quests, quizzes] = await Promise.all([
        listRoster(courseId),
        listCourseQuests(courseId),
        listQuizzes(courseId),
      ]);
      const items = [
        ...quests
          .filter((q) => q.published)
          .map((q) => ({ id: q.id, title: q.title, kind: 'ภารกิจ' })),
        ...quizzes
          .filter((q) => q.published)
          .map((q) => ({ id: q.id, title: q.title, kind: 'แบบทดสอบ' })),
      ];
      const grades = await getGrades(courseId, new Map(quests.map((q) => [q.id, q.max_score])));
      return { roster, items, grades };
    },
  });
  if (data.isPending) return <PageSkeleton />;
  if (data.isError) return <ErrorState onRetry={() => void data.refetch()} />;
  const { roster, items, grades } = data.data;
  if (!roster.length) return <EmptyState icon={GraduationCap} title="ยังไม่มีนักเรียนในวิชานี้" />;
  if (!items.length)
    return <EmptyState icon={GraduationCap} title="ยังไม่มีภารกิจหรือแบบทดสอบที่เผยแพร่" />;

  const exportCsv = () =>
    downloadCsv(
      fileName,
      toCsv([
        ['รหัส', 'ชื่อ', ...items.map((i) => `${i.kind}: ${i.title}`)],
        ...roster.map((s) => [
          s.studentCode,
          s.name,
          ...items.map((i) => {
            const c = grades.get(`${i.id}:${s.id}`);
            return c?.score ?? null;
          }),
        ]),
      ]),
    );

  return (
    <section aria-labelledby="gb-h" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="gb-h" className="text-lg font-semibold">
          {roster.length} คน · {items.length} รายการ
        </h2>
        <Button variant="outline" onClick={exportCsv}>
          <Download aria-hidden />
          ส่งออก CSV
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="text-sm">
          <caption className="sr-only">สมุดคะแนนรายวิชา</caption>
          <thead>
            <tr className="border-b">
              <th scope="col" className="sticky left-0 bg-card p-3 text-left">
                นักเรียน
              </th>
              {items.map((i) => (
                <th
                  key={i.id}
                  scope="col"
                  className="max-w-40 min-w-28 p-3 text-left align-bottom font-medium"
                >
                  <span className="block text-xs font-normal text-muted-foreground">{i.kind}</span>
                  {i.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roster.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <th
                  scope="row"
                  className="sticky left-0 bg-card p-3 text-left font-normal whitespace-nowrap"
                >
                  {s.name}
                  {s.studentCode && (
                    <span className="text-xs text-muted-foreground"> · {s.studentCode}</span>
                  )}
                </th>
                {items.map((i) => {
                  const c = grades.get(`${i.id}:${s.id}`);
                  return (
                    <td key={i.id} className={c ? 'p-3 tabular-nums' : 'p-3 text-muted-foreground'}>
                      {show(c)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        “–” = ยังไม่ส่ง · “แก้ไข” = ครูให้แก้ไขงาน · ไฟล์ CSV เปิดใน Excel/Google Sheets ได้ภาษาไทยถูกต้อง
      </p>
    </section>
  );
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, UserMinus, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Button, buttonVariants } from '@/components/ui/button';
import { inputClass } from '@/components/ui/field-utils';
import { flagLabels, getDashboard } from '@/features/analytics/api';
import { listRoster, removeFromCourse } from '../api';
import { CoursePicker } from '../CoursePicker';
import { defaultCourse, useTeacherCourses } from '../courseHooks';

export default function StudentsPage() {
  const courses = useTeacherCourses();
  const [picked, setPicked] = useState('');
  const courseId = picked || defaultCourse(courses.data);
  if (courses.isPending) return <PageSkeleton />;
  if (courses.isError) return <ErrorState onRetry={() => void courses.refetch()} />;
  if (!courses.data.length)
    return (
      <EmptyState
        icon={Users}
        title="ยังไม่มีรายวิชา"
        description="สร้างรายวิชาก่อน แล้วแจกรหัสเข้าร่วมให้นักเรียน"
      />
    );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">นักเรียน</h1>
          <p className="text-sm text-muted-foreground">
            นักเรียนเข้าวิชาเองด้วยรหัสเข้าร่วม ครูดูความคืบหน้าและจัดการรายชื่อได้ที่นี่
          </p>
        </div>
        <Link
          to={`/teacher/courses/${courseId}`}
          className={buttonVariants({ variant: 'outline' })}
        >
          <KeyRound aria-hidden />
          รหัสเข้าร่วมวิชา
        </Link>
      </div>
      <CoursePicker courses={courses.data} value={courseId} onChange={setPicked} />
      <Roster key={courseId} courseId={courseId} />
    </div>
  );
}

function Roster({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const roster = useQuery({ queryKey: ['roster', courseId], queryFn: () => listRoster(courseId) });
  const dash = useQuery({
    queryKey: ['dashboard', courseId, '', ''],
    queryFn: () => getDashboard(courseId, null, null),
  });
  const remove = useMutation({
    mutationFn: (userId: string) => removeFromCourse(courseId, userId),
    onSuccess: () => {
      toast.success('นำออกจากรายวิชาแล้ว (ผลงานเดิมยังเก็บไว้)');
      void qc.invalidateQueries({ queryKey: ['roster', courseId] });
      void qc.invalidateQueries({ queryKey: ['dashboard', courseId] });
    },
    onError: () => toast.error('นำออกไม่สำเร็จ'),
  });
  if (roster.isPending) return <PageSkeleton />;
  if (roster.isError) return <ErrorState onRetry={() => void roster.refetch()} />;
  if (!roster.data.length)
    return (
      <EmptyState
        icon={Users}
        title="ยังไม่มีนักเรียนในวิชานี้"
        description="แจกรหัสเข้าร่วมให้นักเรียน แล้วรายชื่อจะขึ้นที่นี่ทันที"
      />
    );

  const stats = new Map(dash.data?.students.map((s) => [s.user_id, s]));
  const q = search.trim();
  const rows = roster.data.filter(
    (s) => !q || s.name.includes(q) || (s.studentCode ?? '').includes(q) || s.email.includes(q),
  );
  return (
    <section aria-labelledby="roster-h" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="roster-h" className="text-lg font-semibold">
          รายชื่อ {roster.data.length} คน
        </h2>
        <div>
          <label htmlFor="roster-search" className="sr-only">
            ค้นหานักเรียน
          </label>
          <input
            id="roster-search"
            type="search"
            placeholder="ค้นหาชื่อ รหัส หรืออีเมล"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClass} w-64`}
          />
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[52rem] text-sm">
          <caption className="sr-only">รายชื่อนักเรียนในรายวิชา</caption>
          <thead>
            <tr className="border-b text-left">
              <th scope="col" className="p-3">
                รหัส
              </th>
              <th scope="col" className="p-3">
                ชื่อ
              </th>
              <th scope="col" className="p-3 text-right">
                บทเรียน
              </th>
              <th scope="col" className="p-3 text-right">
                ภารกิจผ่าน
              </th>
              <th scope="col" className="p-3 text-right">
                XP
              </th>
              <th scope="col" className="p-3">
                สิ่งที่ควรดู
              </th>
              <th scope="col" className="p-3">
                <span className="sr-only">จัดการ</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const st = stats.get(s.id);
              return (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="p-3 tabular-nums">{s.studentCode ?? '–'}</td>
                  <th scope="row" className="p-3 text-left font-normal">
                    <Link
                      to={`/teacher/courses/${courseId}/portfolio/${s.id}`}
                      className="font-medium hover:underline"
                    >
                      {s.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{s.email}</span>
                  </th>
                  <td className="p-3 text-right tabular-nums">
                    {st ? `${st.lessons_done}/${dash.data?.lessons_total}` : '–'}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {st ? `${st.quests_approved}/${dash.data?.quests_total}` : '–'}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {st ? st.xp.toLocaleString('th-TH') : '–'}
                  </td>
                  <td className="p-3">
                    <ul className="flex flex-wrap gap-1">
                      {st?.flags.map((f) => (
                        <li key={f} className="rounded-full bg-warning/25 px-2 py-0.5 text-xs">
                          {flagLabels[f]}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Link
                      to={`/teacher/courses/${courseId}/competency/${s.id}`}
                      className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                    >
                      สมรรถนะ
                    </Link>
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="sm" aria-label={`นำ ${s.name} ออกจากรายวิชา`}>
                          <UserMinus aria-hidden />
                        </Button>
                      }
                      title={`นำ ${s.name} ออกจากรายวิชา?`}
                      description="นักเรียนจะเข้าวิชานี้ไม่ได้จนกว่าจะใช้รหัสเข้าร่วมอีกครั้ง ผลงาน คะแนน และ XP ที่มีอยู่จะไม่ถูกลบ"
                      confirmLabel="นำออก"
                      destructive
                      onConfirm={() => remove.mutate(s.id)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

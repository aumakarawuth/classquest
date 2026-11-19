import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BookOpen, ClipboardCheck, Swords, Target, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { inputClass } from '@/components/ui/field-utils';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/features/auth/useAuth';
import { listMyCourses } from '@/features/courses/api';
import { getBuilder } from '@/features/learning/api';
import { ClassHealth } from '../ClassHealth';
import { flagLabels, getDashboard, type Dashboard } from '../api';

const periods = [
  { value: '7', label: '7 วันล่าสุด' },
  { value: '30', label: '30 วันล่าสุด' },
  { value: '', label: 'ทั้งภาคเรียน' },
];
const fmt = (x: number | null, unit = '%') =>
  x === null ? '–' : `${x.toLocaleString('th-TH')}${unit}`;

export default function TeacherDashboardPage() {
  const { userId } = useAuth();
  const courses = useQuery({
    queryKey: ['courses', 'teacher', userId],
    queryFn: () => listMyCourses(userId ?? '', 'teacher'),
    enabled: !!userId,
  });
  const [courseId, setCourseId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [period, setPeriod] = useState('');
  const selected =
    courseId ||
    courses.data?.find((c) => c.status === 'published')?.id ||
    courses.data?.[0]?.id ||
    '';
  const units = useQuery({
    queryKey: ['builder', selected],
    queryFn: () => getBuilder(selected),
    enabled: !!selected,
  });
  const dash = useQuery({
    queryKey: ['dashboard', selected, unitId, period],
    queryFn: () => getDashboard(selected, unitId || null, period ? Number(period) : null),
    enabled: !!selected,
  });

  if (courses.isPending) return <PageSkeleton />;
  if (!courses.data?.length) {
    return (
      <EmptyState
        icon={BookOpen}
        title="ยังไม่มีรายวิชา"
        description="สร้างรายวิชาแรกเพื่อเริ่มใช้งาน"
        action={
          <Link to="/teacher/courses/new" className={buttonVariants()}>
            สร้างรายวิชา
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ภาพรวมการเรียนรู้</h1>
        <p className="text-sm text-muted-foreground">
          คำนวณจากข้อมูลจริงในระบบ ค่าที่ยังไม่มีข้อมูลแสดงเป็น “–”
        </p>
      </div>
      <Card className="grid gap-3 p-4 sm:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="d-course" className="block text-sm font-medium">
            รายวิชา
          </label>
          <select
            id="d-course"
            value={selected}
            onChange={(e) => {
              setCourseId(e.target.value);
              setUnitId('');
            }}
            className={inputClass}
          >
            {courses.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} {c.name} ({c.term}/{c.academicYear})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="d-unit" className="block text-sm font-medium">
            หน่วยการเรียนรู้
          </label>
          <select
            id="d-unit"
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            className={inputClass}
          >
            <option value="">ทุกหน่วย</option>
            {units.data?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.title}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="d-period" className="block text-sm font-medium">
            ช่วงเวลา
          </label>
          <select
            id="d-period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className={inputClass}
          >
            {periods.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </Card>
      {dash.isPending ? (
        <PageSkeleton />
      ) : dash.isError ? (
        <ErrorState onRetry={() => void dash.refetch()} />
      ) : (
        <DashboardBody d={dash.data} courseId={selected} />
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  progress,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  sub?: string;
  progress?: number | null;
}) {
  return (
    <Card className="space-y-2 p-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" aria-hidden />
        {label}
      </p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {progress !== undefined && progress !== null && <Progress value={progress} label={label} />}
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

function DashboardBody({ d, courseId }: { d: Dashboard; courseId: string }) {
  const [search, setSearch] = useState('');
  const support = d.students.filter((s) => s.flags.length > 0);
  const visible = d.students.filter(
    (s) => !search || s.display_name.includes(search) || (s.student_code ?? '').includes(search),
  );
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={Users}
          label="ผู้เรียน"
          value={`${d.students_total}`}
          sub={`เข้าใช้งานใน 7 วัน ${d.active_7d} คน`}
        />
        <Stat
          icon={BookOpen}
          label="เรียนบทเรียนจบ"
          value={fmt(d.lesson_completion_rate)}
          progress={d.lesson_completion_rate}
          sub={`${d.lessons_total} บทเรียน`}
        />
        <Stat
          icon={Swords}
          label="ภารกิจผ่าน"
          value={fmt(d.quest_completion_rate)}
          progress={d.quest_completion_rate}
          sub={`${d.quests_total} ภารกิจ · คะแนนเฉลี่ย ${fmt(d.avg_quest_pct)}`}
        />
        <Stat
          icon={ClipboardCheck}
          label="งานรอตรวจ"
          value={`${d.pending_reviews}`}
          sub="ส่งแล้ว รอครูตรวจ"
        />
        <Stat
          icon={Target}
          label="สมรรถนะที่ผ่าน"
          value={fmt(d.competency_pass_rate)}
          sub={`ประเมินแล้ว ${fmt(d.competency_assessed_rate)} ของทั้งหมด`}
        />
        <Stat
          icon={ClipboardCheck}
          label="Pre-test → Post-test"
          value={`${fmt(d.pretest_mean)} → ${fmt(d.posttest_mean)}`}
          sub="ค่าเฉลี่ยครั้งแรก (ทุกคนที่ทำ)"
        />
        <Stat icon={ClipboardCheck} label="คะแนนแบบทดสอบเฉลี่ย" value={fmt(d.avg_quiz_pct)} />
        <Stat
          icon={AlertTriangle}
          label="ต้องได้รับการช่วยเหลือ"
          value={`${support.length}`}
          sub="ดูรายชื่อด้านล่าง"
        />
      </div>
      <ClassHealth d={d} courseId={courseId} />
      <div className="flex flex-wrap gap-2">
        <Link to="/teacher/reviews" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          ไปตรวจงาน
        </Link>
        <Link
          to={`/teacher/courses/${courseId}/competency-matrix`}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          ตารางสมรรถนะ
        </Link>
        <Link
          to={`/teacher/courses/${courseId}/prepost`}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          เปรียบเทียบก่อน–หลังเรียน
        </Link>
      </div>

      <section aria-labelledby="support-h" className="space-y-3">
        <h2 id="support-h" className="text-lg font-semibold">
          นักเรียนที่ควรได้รับการช่วยเหลือ
        </h2>
        {support.length === 0 ? (
          <p className="text-sm text-muted-foreground">ไม่มีนักเรียนที่เข้าเงื่อนไข</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {support.map((s) => (
              <li key={s.user_id}>
                <Card className="space-y-2 p-4">
                  <Link
                    to={`/teacher/courses/${courseId}/competency/${s.user_id}`}
                    className="font-medium text-primary underline"
                  >
                    {s.display_name}
                  </Link>
                  <Link
                    to={`/teacher/courses/${courseId}/portfolio/${s.user_id}`}
                    className="ml-3 text-xs text-muted-foreground underline"
                  >
                    แฟ้มผลงาน
                  </Link>
                  <ul className="flex flex-wrap gap-1">
                    {s.flags.map((f) => (
                      <li key={f} className="rounded-full bg-warning/25 px-2 py-0.5 text-xs">
                        {flagLabels[f]}
                      </li>
                    ))}
                  </ul>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="students-h" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="students-h" className="text-lg font-semibold">
            ผู้เรียนรายบุคคล
          </h2>
          <div>
            <label htmlFor="d-search" className="sr-only">
              ค้นหานักเรียน
            </label>
            <input
              id="d-search"
              type="search"
              placeholder="ค้นหาชื่อหรือรหัส"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} w-60`}
            />
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[48rem] text-sm">
            <caption className="sr-only">ความก้าวหน้าของผู้เรียนรายบุคคล</caption>
            <thead>
              <tr className="border-b text-left">
                <th scope="col" className="p-3">
                  นักเรียน
                </th>
                <th scope="col" className="p-3">
                  ใช้งานล่าสุด
                </th>
                <th scope="col" className="p-3 text-right">
                  บทเรียน
                </th>
                <th scope="col" className="p-3 text-right">
                  ภารกิจผ่าน
                </th>
                <th scope="col" className="p-3 text-right">
                  คะแนนภารกิจ
                </th>
                <th scope="col" className="p-3 text-right">
                  แบบทดสอบ
                </th>
                <th scope="col" className="p-3 text-right">
                  XP
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <tr key={s.user_id} className="border-b last:border-0">
                  <th scope="row" className="p-3 text-left font-normal">
                    {s.display_name}
                    {s.student_code && (
                      <span className="text-xs text-muted-foreground"> · {s.student_code}</span>
                    )}
                  </th>
                  <td className="p-3">
                    {s.last_active
                      ? new Date(`${s.last_active}T00:00:00+07:00`).toLocaleDateString('th-TH', {
                          timeZone: 'Asia/Bangkok',
                          dateStyle: 'medium',
                        })
                      : 'ยังไม่เคย'}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {s.lessons_done}/{d.lessons_total}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {s.quests_approved}/{d.quests_total}
                  </td>
                  <td className="p-3 text-right tabular-nums">{fmt(s.avg_quest_pct)}</td>
                  <td className="p-3 text-right tabular-nums">{fmt(s.avg_quiz_pct)}</td>
                  <td className="p-3 text-right tabular-nums">{s.xp.toLocaleString('th-TH')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

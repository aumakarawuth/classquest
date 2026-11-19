import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Copy, KeyRound, Layers } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatThaiDateTime } from '@/lib/datetime';
import {
  cloneCourse,
  countUnits,
  courseErrorMessage,
  createEnrollmentCode,
  deactivateEnrollmentCode,
  getCourse,
  listEnrollmentCodes,
  setCourseStatus,
  type Course,
} from '../api';
import {
  courseLevelLabels,
  courseStatusLabels,
  currentAcademicTerm,
  type CourseStatus,
} from '../schemas';

export default function TeacherCourseDetailPage() {
  const { courseId = '' } = useParams();
  const course = useQuery({
    queryKey: ['courses', 'detail', courseId],
    queryFn: () => getCourse(courseId),
  });

  if (course.isPending) return <PageSkeleton />;
  if (course.isError) return <ErrorState onRetry={() => void course.refetch()} />;
  if (!course.data)
    return <EmptyState title="ไม่พบรายวิชา" description="รายวิชาอาจถูกลบหรือคุณไม่ได้เป็นผู้สอน" />;
  return <CourseDetail course={course.data} />;
}

function CourseDetail({ course }: { course: Course }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['courses'] });
  const onError = (e: unknown) => toast.error(courseErrorMessage(e));

  const units = useQuery({
    queryKey: ['courses', 'units-count', course.id],
    queryFn: () => countUnits(course.id),
  });

  const status = useMutation({
    mutationFn: (next: CourseStatus) => setCourseStatus(course.id, next),
    onSuccess: (_, next) => {
      toast.success(`เปลี่ยนสถานะเป็น "${courseStatusLabels[next]}" แล้ว`);
      invalidate();
    },
    onError,
  });

  const next = currentAcademicTerm();
  const clone = useMutation({
    mutationFn: () => cloneCourse(course.id, next.term, next.academicYear, course.classroom),
    onSuccess: (id) => {
      toast.success('คัดลอกรายวิชาแล้ว (ฉบับร่าง ไม่มีข้อมูลนักเรียน)');
      invalidate();
      void navigate(`/teacher/courses/${id}`);
    },
    onError,
  });

  return (
    <div className="space-y-6">
      <Link
        to="/teacher/courses"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        รายวิชาทั้งหมด
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{course.code}</p>
          <h1 className="text-2xl font-bold tracking-tight">{course.name}</h1>
          <p className="text-sm text-muted-foreground">
            {courseLevelLabels[course.level]} {course.classroom} · ภาคเรียน {course.term}/
            {course.academicYear} · สถานะ{' '}
            <strong className="text-foreground">{courseStatusLabels[course.status]}</strong>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {course.status !== 'published' && (
            <ConfirmDialog
              trigger={<Button>เผยแพร่</Button>}
              title="เผยแพร่รายวิชา?"
              description="นักเรียนที่เข้าร่วมแล้วจะเห็นหน่วยการเรียนรู้และบทเรียนที่เผยแพร่"
              onConfirm={() => status.mutate('published')}
            />
          )}
          {course.status === 'published' && (
            <Button
              variant="outline"
              onClick={() => status.mutate('draft')}
              disabled={status.isPending}
            >
              กลับเป็นฉบับร่าง
            </Button>
          )}
          {course.status !== 'archived' && (
            <ConfirmDialog
              trigger={<Button variant="outline">เก็บถาวร</Button>}
              title="เก็บรายวิชาถาวร?"
              description="นักเรียนใหม่จะเข้าร่วมไม่ได้ ข้อมูลยังคงอยู่และเปิดกลับได้"
              onConfirm={() => status.mutate('archived')}
            />
          )}
          <ConfirmDialog
            trigger={
              <Button variant="outline" disabled={clone.isPending}>
                <Copy aria-hidden />
                คัดลอกไปภาคเรียนใหม่
              </Button>
            }
            title="คัดลอกรายวิชา?"
            description={`สร้างฉบับร่างสำหรับภาคเรียน ${next.term}/${next.academicYear} พร้อมหน่วยการเรียนรู้และบทเรียน (ไม่คัดลอกนักเรียนและผลการเรียน)`}
            confirmLabel="คัดลอก"
            onConfirm={() => clone.mutate()}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <EnrollmentCodes courseId={course.id} disabled={course.status === 'archived'} />
        <Card className="space-y-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <Layers className="size-5 text-secondary" aria-hidden />
            หน่วยการเรียนรู้
          </h2>
          <p className="text-3xl font-bold tabular-nums">{units.data ?? '–'}</p>
          <Link
            to={`/teacher/courses/${course.id}/builder`}
            className={buttonVariants({ variant: 'outline' })}
          >
            ออกแบบหน่วยและบทเรียน
          </Link>
          <Link
            to={`/teacher/courses/${course.id}/quests`}
            className={buttonVariants({ variant: 'outline' })}
          >
            จัดการภารกิจ
          </Link>
          <Link
            to={`/teacher/courses/${course.id}/levels`}
            className={buttonVariants({ variant: 'outline' })}
          >
            เลเวลและ XP
          </Link>
        </Card>
      </div>
    </div>
  );
}

function EnrollmentCodes({ courseId, disabled }: { courseId: string; disabled: boolean }) {
  const queryClient = useQueryClient();
  const [maxUses, setMaxUses] = useState('');
  const [days, setDays] = useState('14');
  const codes = useQuery({
    queryKey: ['courses', 'codes', courseId],
    queryFn: () => listEnrollmentCodes(courseId),
  });
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: ['courses', 'codes', courseId] });
  const onError = (e: unknown) => toast.error(courseErrorMessage(e));

  const create = useMutation({
    mutationFn: () => {
      const d = Number(days);
      const expires = d > 0 ? new Date(Date.now() + d * 86_400_000).toISOString() : null;
      const uses = Number(maxUses);
      return createEnrollmentCode(courseId, expires, uses > 0 ? uses : null);
    },
    onSuccess: () => {
      toast.success('สร้างรหัสเข้าร่วมแล้ว');
      refresh();
    },
    onError,
  });
  const deactivate = useMutation({
    mutationFn: deactivateEnrollmentCode,
    onSuccess: () => {
      toast.success('ปิดรหัสแล้ว');
      refresh();
    },
    onError,
  });

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`คัดลอก ${code} แล้ว`);
    } catch {
      toast.error('คัดลอกไม่สำเร็จ กรุณาคัดลอกด้วยตนเอง');
    }
  };

  return (
    <Card className="space-y-4 lg:col-span-2">
      <h2 className="flex items-center gap-2 font-semibold">
        <KeyRound className="size-5 text-primary" aria-hidden />
        รหัสเข้าร่วมรายวิชา
      </h2>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div className="space-y-1">
          <label htmlFor="code-days" className="block text-xs text-muted-foreground">
            หมดอายุใน (วัน, 0 = ไม่หมดอายุ)
          </label>
          <input
            id="code-days"
            type="number"
            min={0}
            max={365}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="min-h-11 w-28 rounded-lg border bg-card px-3 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="code-max" className="block text-xs text-muted-foreground">
            ใช้ได้สูงสุด (ว่าง = ไม่จำกัด)
          </label>
          <input
            id="code-max"
            type="number"
            min={1}
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            className="min-h-11 w-28 rounded-lg border bg-card px-3 text-sm"
          />
        </div>
        <Button type="submit" disabled={disabled || create.isPending}>
          สร้างรหัส
        </Button>
      </form>
      {disabled && <p className="text-sm text-muted-foreground">รายวิชาที่เก็บถาวรสร้างรหัสใหม่ไม่ได้</p>}

      {codes.isPending ? (
        <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
      ) : codes.isError ? (
        <ErrorState onRetry={() => void codes.refetch()} />
      ) : codes.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          ยังไม่มีรหัส สร้างรหัสแล้วแจกนักเรียนหรือแปะใน Google Classroom
        </p>
      ) : (
        <ul className="divide-y">
          {codes.data.map((c) => {
            const expired =
              c.expires_at !== null &&
              new Date(c.expires_at).getTime() < (codes.dataUpdatedAt || 0);
            const usable = c.is_active && !expired && (c.max_uses === null || c.uses < c.max_uses);
            return (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p
                    className={
                      usable
                        ? 'font-mono text-lg font-bold tracking-widest'
                        : 'font-mono text-lg tracking-widest text-muted-foreground line-through'
                    }
                  >
                    {c.code}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ใช้แล้ว {c.uses}
                    {c.max_uses !== null && `/${c.max_uses}`} ครั้ง ·{' '}
                    {c.expires_at ? `หมดอายุ ${formatThaiDateTime(c.expires_at)}` : 'ไม่หมดอายุ'}
                    {!c.is_active && ' · ปิดแล้ว'}
                  </p>
                </div>
                {usable && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => void copy(c.code)}>
                      <Copy aria-hidden />
                      คัดลอก
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="sm">
                          ปิดรหัส
                        </Button>
                      }
                      title={`ปิดรหัส ${c.code}?`}
                      description="นักเรียนจะใช้รหัสนี้เข้าร่วมไม่ได้อีก (ผู้ที่เข้าร่วมแล้วไม่ได้รับผลกระทบ)"
                      confirmLabel="ปิดรหัส"
                      destructive
                      onConfirm={() => deactivate.mutate(c.id)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

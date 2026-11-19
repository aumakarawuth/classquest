import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, ExternalLink, Upload } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { inputClass } from '@/components/ui/field-utils';
import { useAuth } from '@/features/auth/useAuth';
import { listMyCourses } from '@/features/courses/api';
import {
  CLASSROOM_URL,
  getConnection,
  gradebookExport,
  gradebookRows,
  importRoster,
  listInvites,
  removeConnection,
  saveConnection,
} from '../api';
import { downloadText, parseCsv, rosterFromCsv, toCsv, type RosterRow } from '../csv';

export default function ClassroomPage() {
  const { userId } = useAuth();
  const courses = useQuery({
    queryKey: ['courses', 'teacher', userId],
    queryFn: () => listMyCourses(userId ?? '', 'teacher'),
    enabled: !!userId,
  });
  const [courseId, setCourseId] = useState('');
  const selected = courseId || courses.data?.[0]?.id || '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Google Classroom</h1>
        <p className="text-sm text-muted-foreground">
          ใช้ร่วมกับ Google Classroom แบบลิงก์และไฟล์ CSV — ไม่ต้องใช้ Classroom API (ทำงานได้แม้ API ใช้ไม่ได้)
        </p>
      </div>
      {courses.isPending ? (
        <PageSkeleton />
      ) : !courses.data?.length ? (
        <EmptyState title="ยังไม่มีรายวิชา" />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <label htmlFor="gc-course" className="text-sm font-medium">
              รายวิชา
            </label>
            <select
              id="gc-course"
              value={selected}
              onChange={(e) => setCourseId(e.target.value)}
              className={`${inputClass} max-w-md`}
            >
              {courses.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} {c.name} ({c.term}/{c.academicYear})
                </option>
              ))}
            </select>
          </div>
          {selected && <CoursePanel key={selected} courseId={selected} />}
        </>
      )}
    </div>
  );
}

function CoursePanel({ courseId }: { courseId: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <LinkCard courseId={courseId} />
      <ExportCard courseId={courseId} />
      <RosterCard courseId={courseId} />
    </div>
  );
}

function LinkCard({ courseId }: { courseId: string }) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const link = useQuery({
    queryKey: ['classroom', 'link', courseId],
    queryFn: () => getConnection(courseId),
  });
  const [value, setValue] = useState<string | null>(null);
  const current = value ?? link.data ?? '';
  const valid = CLASSROOM_URL.test(current.trim());
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: ['classroom', 'link', courseId] });
  const save = useMutation({
    mutationFn: () => saveConnection(courseId, current, userId ?? ''),
    onSuccess: () => {
      toast.success('บันทึกลิงก์แล้ว');
      setValue(null);
      refresh();
    },
    onError: () => toast.error('บันทึกไม่สำเร็จ'),
  });
  const remove = useMutation({
    mutationFn: () => removeConnection(courseId),
    onSuccess: () => {
      toast.success('ยกเลิกการเชื่อมโยงแล้ว');
      setValue(null);
      refresh();
    },
  });
  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">ลิงก์ห้องเรียน Google Classroom</h2>
      <p className="text-xs text-muted-foreground">
        นักเรียนจะเห็นปุ่ม “เปิด Google Classroom” ในหน้ารายวิชา งานที่ให้ส่งใน Classroom กำหนดได้ที่ภารกิจ (วิธีส่ง:
        Google Classroom)
      </p>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) save.mutate();
        }}
      >
        <label htmlFor="gc-link" className="sr-only">
          ลิงก์ Google Classroom
        </label>
        <input
          id="gc-link"
          type="url"
          value={current}
          placeholder="https://classroom.google.com/c/..."
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={current !== '' && !valid ? true : undefined}
          aria-describedby="gc-link-hint"
          className={inputClass}
        />
        <p id="gc-link-hint" className="text-xs text-muted-foreground">
          ต้องขึ้นต้นด้วย https://classroom.google.com/
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!valid || save.isPending}>
            บันทึก
          </Button>
          {link.data && (
            <a
              href={link.data}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'outline' })}
            >
              <ExternalLink aria-hidden />
              เปิด
            </a>
          )}
          {link.data && (
            <ConfirmDialog
              trigger={
                <Button type="button" variant="ghost">
                  ยกเลิกการเชื่อมโยง
                </Button>
              }
              title="ยกเลิกการเชื่อมโยง?"
              description="ข้อมูลใน Google Classroom ไม่ได้รับผลกระทบ"
              onConfirm={() => remove.mutate()}
            />
          )}
        </div>
      </form>
    </Card>
  );
}

function ExportCard({ courseId }: { courseId: string }) {
  const [includeXp, setIncludeXp] = useState(false);
  const exp = useMutation({
    mutationFn: () => gradebookExport(courseId),
    onSuccess: (g) => {
      downloadText(
        `gradebook-${new Date().toISOString().slice(0, 10)}.csv`,
        toCsv(gradebookRows(g, includeXp)),
      );
      toast.success(`ส่งออก ${g.students.length} คน ${g.items.length} รายการ`);
    },
    onError: () => toast.error('ส่งออกไม่สำเร็จ'),
  });
  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">ส่งออกคะแนน (CSV)</h2>
      <p className="text-xs text-muted-foreground">
        คะแนนภารกิจที่อนุมัติแล้ว และคะแนนแบบทดสอบครั้งแรกที่ตรวจเสร็จ ใช้คัดลอกไปกรอกใน Google Classroom หรือ
        Google Sheets — ระบบไม่ส่งคะแนนเข้า Classroom โดยอัตโนมัติ
      </p>
      <label className="inline-flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={includeXp}
          onChange={(e) => setIncludeXp(e.target.checked)}
          className="size-5 accent-[var(--primary)]"
        />
        เพิ่มคอลัมน์ XP (แยกจากคะแนน)
      </label>
      <Button onClick={() => exp.mutate()} disabled={exp.isPending}>
        <Download aria-hidden />
        ดาวน์โหลด CSV
      </Button>
    </Card>
  );
}

function RosterCard({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const invites = useQuery({
    queryKey: ['classroom', 'invites', courseId],
    queryFn: () => listInvites(courseId),
  });
  const [preview, setPreview] = useState<{
    valid: RosterRow[];
    invalid: { line: number; value: string }[];
  } | null>(null);
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast.error('ไฟล์ต้องไม่เกิน 1 MB');
      return;
    }
    setPreview(rosterFromCsv(parseCsv(await file.text())));
  };
  const imp = useMutation({
    mutationFn: () => importRoster(courseId, preview?.valid ?? []),
    onSuccess: (r) => {
      toast.success(`นำเข้า ${r.invited} คน (ลงทะเบียนทันที ${r.enrolled_now} คน)`);
      setPreview(null);
      void queryClient.invalidateQueries({ queryKey: ['classroom', 'invites', courseId] });
    },
    onError: () => toast.error('นำเข้าไม่สำเร็จ'),
  });
  const claimed = invites.data?.filter((i) => i.claimed_at).length ?? 0;

  return (
    <Card className="space-y-3 lg:col-span-2">
      <h2 className="font-semibold">นำเข้ารายชื่อนักเรียน (CSV)</h2>
      <p className="text-xs text-muted-foreground">
        ใช้ไฟล์ที่มีคอลัมน์อีเมล (และรหัสนักเรียน/ชื่อ ถ้ามี) เช่น รายชื่อจาก Google Classroom ที่ส่งออกเป็น Google Sheets
        นักเรียนจะถูกลงทะเบียนและอนุมัติเป็น “นักเรียน” อัตโนมัติเมื่อเข้าสู่ระบบด้วยอีเมลนั้นครั้งแรก
      </p>
      <label
        htmlFor="roster-file"
        className={buttonVariants({ variant: 'outline' }) + ' cursor-pointer'}
      >
        <Upload aria-hidden />
        เลือกไฟล์ CSV
      </label>
      <input
        id="roster-file"
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {preview && (
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-sm">
            พร้อมนำเข้า <strong>{preview.valid.length}</strong> คน
            {preview.invalid.length > 0 && <> · ข้าม {preview.invalid.length} แถวที่อีเมลไม่ถูกต้อง</>}
          </p>
          {preview.invalid.length > 0 && (
            <ul className="max-h-32 overflow-y-auto text-xs text-destructive">
              {preview.invalid.slice(0, 20).map((x) => (
                <li key={x.line}>
                  แถว {x.line}: {x.value}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Button
              onClick={() => imp.mutate()}
              disabled={!preview.valid.length || preview.valid.length > 500 || imp.isPending}
            >
              นำเข้า
            </Button>
            <Button variant="ghost" onClick={() => setPreview(null)}>
              ยกเลิก
            </Button>
          </div>
        </div>
      )}
      {invites.data && invites.data.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm">
            รายชื่อที่นำเข้าแล้ว ({claimed}/{invites.data.length} เข้าสู่ระบบแล้ว)
          </summary>
          <ul className="mt-2 max-h-64 divide-y overflow-y-auto text-sm">
            {invites.data.map((i) => (
              <li key={i.id} className="flex justify-between gap-2 py-1">
                <span className="truncate">
                  {i.display_name || i.email}
                  {i.student_code && ` · ${i.student_code}`}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {i.claimed_at ? 'เข้าระบบแล้ว' : 'รอเข้าสู่ระบบ'}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

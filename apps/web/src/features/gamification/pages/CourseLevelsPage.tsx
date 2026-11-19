import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { inputClass } from '@/components/ui/field-utils';
import { getLevels, saveCourseLevels, validateLadder, type LevelDefinition } from '../api';

export default function CourseLevelsPage() {
  const { courseId = '' } = useParams();
  const query = useQuery({ queryKey: ['levels', courseId], queryFn: () => getLevels(courseId) });
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        to={`/teacher/courses/${courseId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        กลับไปที่รายวิชา
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">เลเวลและ XP</h1>
        <p className="text-sm text-muted-foreground">
          กำหนด XP ที่ต้องสะสมในแต่ละเลเวล ระบบคำนวณเลเวลของนักเรียนจาก XP ที่บันทึกไว้ใหม่ทันที (ไม่ลด XP ที่ได้แล้ว)
        </p>
      </div>
      {query.isPending ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <LevelsForm
          key={String(query.dataUpdatedAt)}
          courseId={courseId}
          initial={query.data.levels}
          custom={query.data.custom}
        />
      )}
    </div>
  );
}

function LevelsForm({
  courseId,
  initial,
  custom,
}: {
  courseId: string;
  initial: LevelDefinition[];
  custom: boolean;
}) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState(
    initial.map((l) => ({ xp_threshold: l.xp_threshold, title: l.title })),
  );
  const error = validateLadder(rows);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['levels', courseId] });
    void queryClient.invalidateQueries({ queryKey: ['progress'] });
  };
  const save = useMutation({
    mutationFn: (levels: typeof rows) => saveCourseLevels(courseId, levels),
    onSuccess: (_, levels) => {
      toast.success(levels.length ? 'บันทึกเลเวลของรายวิชาแล้ว' : 'กลับไปใช้เลเวลมาตรฐานแล้ว');
      refresh();
    },
    onError: () => toast.error('บันทึกไม่สำเร็จ'),
  });
  const update = (i: number, patch: Partial<(typeof rows)[number]>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <Card className="space-y-4">
      <p className="text-sm">
        {custom
          ? 'รายวิชานี้ใช้เลเวลที่กำหนดเอง'
          : 'รายวิชานี้ใช้เลเวลมาตรฐานของระบบ — แก้ไขแล้วบันทึกเพื่อใช้เลเวลเฉพาะรายวิชา'}
      </p>
      <table className="w-full text-sm">
        <caption className="sr-only">ตารางเลเวล</caption>
        <thead>
          <tr className="text-left text-muted-foreground">
            <th scope="col" className="w-16 pb-2 font-medium">
              เลเวล
            </th>
            <th scope="col" className="pb-2 font-medium">
              XP ขั้นต่ำ
            </th>
            <th scope="col" className="pb-2 font-medium">
              ชื่อเลเวล
            </th>
            <th scope="col" className="w-12 pb-2">
              <span className="sr-only">ลบ</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="py-1 font-semibold tabular-nums">{i + 1}</td>
              <td className="py-1 pr-2">
                <label className="sr-only" htmlFor={`lv-xp-${i}`}>
                  XP ขั้นต่ำของเลเวล {i + 1}
                </label>
                <input
                  id={`lv-xp-${i}`}
                  type="number"
                  min={0}
                  step={10}
                  value={r.xp_threshold}
                  disabled={i === 0}
                  onChange={(e) => update(i, { xp_threshold: Number(e.target.value) })}
                  className={inputClass}
                />
              </td>
              <td className="py-1 pr-2">
                <label className="sr-only" htmlFor={`lv-title-${i}`}>
                  ชื่อเลเวล {i + 1}
                </label>
                <input
                  id={`lv-title-${i}`}
                  value={r.title}
                  maxLength={60}
                  onChange={(e) => update(i, { title: e.target.value })}
                  className={inputClass}
                />
              </td>
              <td className="py-1">
                {i > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`ลบเลเวล ${i + 1}`}
                    onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={rows.length >= 50}
          onClick={() =>
            setRows((p) => [...p, { xp_threshold: (p.at(-1)?.xp_threshold ?? 0) + 100, title: '' }])
          }
        >
          <Plus aria-hidden />
          เพิ่มเลเวล
        </Button>
        <div className="flex gap-2">
          {custom && (
            <ConfirmDialog
              trigger={<Button variant="outline">ใช้เลเวลมาตรฐาน</Button>}
              title="กลับไปใช้เลเวลมาตรฐาน?"
              description="เลเวลเฉพาะรายวิชานี้จะถูกลบ XP ของนักเรียนไม่เปลี่ยน"
              onConfirm={() => save.mutate([])}
            />
          )}
          <Button onClick={() => save.mutate(rows)} disabled={!!error || save.isPending}>
            บันทึกเลเวล
          </Button>
        </div>
      </div>
    </Card>
  );
}

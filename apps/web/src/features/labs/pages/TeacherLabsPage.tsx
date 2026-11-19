import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { inputClass } from '@/components/ui/field-utils';
import { listCourseQuests } from '@/features/quests/api';
import { deleteLab, listLabs, saveLab, validateLab, type Lab, type LabInput } from '../api';

const empty: LabInput = {
  unit_id: null,
  quest_id: null,
  title: '',
  project_url: '',
  allow_embed: false,
  instructions_md: '',
  diagram_url: null,
  source_code: '',
  expected_result: '',
  components: [],
  position: 1,
  published: false,
};

export default function TeacherLabsPage() {
  const { courseId = '' } = useParams();
  const queryClient = useQueryClient();
  const labs = useQuery({ queryKey: ['labs', courseId], queryFn: () => listLabs([courseId]) });
  const quests = useQuery({
    queryKey: ['quests', 'course', courseId],
    queryFn: () => listCourseQuests(courseId),
  });
  const [editing, setEditing] = useState<Lab | 'new' | null>(null);
  const remove = useMutation({
    mutationFn: deleteLab,
    onSuccess: () => {
      toast.success('ลบการทดลองแล้ว');
      void queryClient.invalidateQueries({ queryKey: ['labs'] });
    },
  });

  return (
    <div className="space-y-6">
      <Link
        to={`/teacher/courses/${courseId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        กลับไปที่รายวิชา
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Virtual Lab</h1>
          <p className="text-sm text-muted-foreground">
            กิจกรรมทดลองบน Wokwi — ให้นักเรียนส่งหลักฐานผ่านภารกิจที่ผูกไว้
          </p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus aria-hidden />
          เพิ่มการทดลอง
        </Button>
      </div>
      {editing && (
        <LabForm
          key={editing === 'new' ? 'new' : editing.id}
          courseId={courseId}
          lab={editing === 'new' ? null : editing}
          quests={quests.data ?? []}
          onDone={() => setEditing(null)}
        />
      )}
      {labs.isPending ? (
        <PageSkeleton />
      ) : labs.isError ? (
        <ErrorState onRetry={() => void labs.refetch()} />
      ) : labs.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีการทดลอง</p>
      ) : (
        <ul className="space-y-2">
          {labs.data.map((l) => (
            <li key={l.id}>
              <Card className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <h2 className="font-semibold">{l.title}</h2>
                  <p className="text-xs text-muted-foreground">
                    {l.published ? 'เผยแพร่' : 'ฉบับร่าง'}
                    {l.components.length > 0 && ` · ${l.components.join(', ')}`}
                    {l.quest_id &&
                      ` · ส่งหลักฐาน: ${quests.data?.find((q) => q.id === l.quest_id)?.title ?? 'ภารกิจ'}`}
                  </p>
                </div>
                <div className="flex shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`แก้ไข ${l.title}`}
                    onClick={() => setEditing(l)}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="icon" aria-label={`ลบ ${l.title}`}>
                        <Trash2 aria-hidden />
                      </Button>
                    }
                    title="ลบการทดลอง?"
                    description="ภารกิจและงานที่ส่งไม่ได้รับผลกระทบ"
                    confirmLabel="ลบ"
                    destructive
                    onConfirm={() => remove.mutate(l.id)}
                  />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LabForm({
  courseId,
  lab,
  quests,
  onDone,
}: {
  courseId: string;
  lab: Lab | null;
  quests: { id: string; title: string }[];
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [v, setV] = useState<LabInput>(lab ? { ...lab } : empty);
  const [components, setComponents] = useState((lab?.components ?? []).join(', '));
  const [touched, setTouched] = useState(false);
  const set = (p: Partial<LabInput>) => setV((x) => ({ ...x, ...p }));
  const error = validateLab(v);
  const save = useMutation({
    mutationFn: () =>
      saveLab(courseId, lab?.id ?? null, {
        ...v,
        title: v.title.trim(),
        project_url: v.project_url.trim(),
        diagram_url: v.diagram_url?.trim() || null,
        components: components
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean)
          .slice(0, 20),
      }),
    onSuccess: () => {
      toast.success('บันทึกการทดลองแล้ว');
      void queryClient.invalidateQueries({ queryKey: ['labs'] });
      onDone();
    },
    onError: () => toast.error('บันทึกไม่สำเร็จ'),
  });
  const area = (
    id: string,
    label: string,
    key: 'instructions_md' | 'source_code' | 'expected_result',
    rows: number,
    mono = false,
  ) => (
    <div className="space-y-1 sm:col-span-2">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={v[key]}
        onChange={(e) => set({ [key]: e.target.value })}
        className={`${inputClass} py-2 ${mono ? 'font-mono' : ''}`}
      />
    </div>
  );
  return (
    <Card>
      <form
        noValidate
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (!error) save.mutate();
        }}
      >
        <h2 className="text-lg font-semibold sm:col-span-2">
          {lab ? 'แก้ไขการทดลอง' : 'เพิ่มการทดลอง'}
        </h2>
        <div className="space-y-1">
          <label htmlFor="lab-title" className="block text-sm font-medium">
            ชื่อการทดลอง
          </label>
          <input
            id="lab-title"
            value={v.title}
            maxLength={200}
            onChange={(e) => set({ title: e.target.value })}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="lab-url" className="block text-sm font-medium">
            ลิงก์โปรเจกต์ Wokwi
          </label>
          <input
            id="lab-url"
            type="url"
            value={v.project_url}
            placeholder="https://wokwi.com/projects/..."
            onChange={(e) => set({ project_url: e.target.value })}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="lab-comp" className="block text-sm font-medium">
            อุปกรณ์ (คั่นด้วย ,)
          </label>
          <input
            id="lab-comp"
            value={components}
            placeholder="ESP32, LED, Ultrasonic Sensor"
            onChange={(e) => setComponents(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="lab-diagram" className="block text-sm font-medium">
            ลิงก์รูปแผนภาพวงจร (ไม่บังคับ)
          </label>
          <input
            id="lab-diagram"
            type="url"
            value={v.diagram_url ?? ''}
            onChange={(e) => set({ diagram_url: e.target.value || null })}
            className={inputClass}
          />
        </div>
        {area('lab-inst', 'ขั้นตอนการทดลอง (Markdown)', 'instructions_md', 6)}
        {area('lab-code', 'โค้ดตัวอย่าง', 'source_code', 6, true)}
        {area('lab-expected', 'ผลลัพธ์ที่คาดหวัง', 'expected_result', 3)}
        <div className="space-y-1">
          <label htmlFor="lab-quest" className="block text-sm font-medium">
            ภารกิจสำหรับส่งหลักฐาน
          </label>
          <select
            id="lab-quest"
            value={v.quest_id ?? ''}
            onChange={(e) => set({ quest_id: e.target.value || null })}
            className={inputClass}
          >
            <option value="">ไม่ผูก</option>
            {quests.map((q) => (
              <option key={q.id} value={q.id}>
                {q.title}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col justify-end gap-1">
          <label className="inline-flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={v.allow_embed}
              onChange={(e) => set({ allow_embed: e.target.checked })}
              className="size-5 accent-[var(--primary)]"
            />
            ฝังในหน้า (ถ้าผู้ดูแลเปิดใช้)
          </label>
          <label className="inline-flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={v.published}
              onChange={(e) => set({ published: e.target.checked })}
              className="size-5 accent-[var(--primary)]"
            />
            เผยแพร่
          </label>
        </div>
        {touched && error && (
          <p role="alert" className="text-sm text-destructive sm:col-span-2">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="outline" onClick={onDone}>
            ยกเลิก
          </Button>
          <Button type="submit" disabled={save.isPending}>
            บันทึก
          </Button>
        </div>
      </form>
    </Card>
  );
}

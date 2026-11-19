import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { inputClass } from '@/components/ui/field-utils';
import { listCourseQuests } from '@/features/quests/api';
import {
  deleteCompetency,
  listCompetencies,
  listMappings,
  saveCompetency,
  setQuestMappings,
  type Competency,
} from '../api';

export default function CompetencyManagePage() {
  const { courseId = '' } = useParams();
  const query = useQuery({
    queryKey: ['competency', 'manage', courseId],
    queryFn: async () => {
      const [competencies, mappings, quests] = await Promise.all([
        listCompetencies(courseId),
        listMappings(courseId),
        listCourseQuests(courseId),
      ]);
      return { competencies, mappings, quests };
    },
  });
  const [editing, setEditing] = useState<Competency | 'new' | null>(null);

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
          <h1 className="text-2xl font-bold tracking-tight">สมรรถนะรายวิชา</h1>
          <p className="text-sm text-muted-foreground">
            กำหนดสมรรถนะ เกณฑ์ผ่าน และภารกิจที่ใช้เป็นหลักฐาน (หรือผูกกับเกณฑ์ Rubric ในหน้าแก้ไขภารกิจ)
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/teacher/courses/${courseId}/competency-matrix`}
            className={buttonVariants({ variant: 'outline' })}
          >
            ตารางสมรรถนะ
          </Link>
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden />
            เพิ่มสมรรถนะ
          </Button>
        </div>
      </div>
      {query.isPending ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <>
          {editing && (
            <CompetencyForm
              key={editing === 'new' ? 'new' : editing.id}
              courseId={courseId}
              competency={editing === 'new' ? null : editing}
              all={query.data.competencies}
              quests={query.data.quests}
              mappedQuestIds={
                editing === 'new'
                  ? []
                  : query.data.mappings
                      .filter((m) => m.competency_id === editing.id && m.target_type === 'quest')
                      .map((m) => m.target_id)
              }
              onDone={() => setEditing(null)}
            />
          )}
          {query.data.competencies.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีสมรรถนะ</p>
          ) : (
            <ul className="space-y-2">
              {query.data.competencies.map((k) => (
                <CompetencyRow
                  key={k.id}
                  competency={k}
                  parent={query.data.competencies.find((p) => p.id === k.parent_id)}
                  questTitles={query.data.mappings
                    .filter((m) => m.competency_id === k.id && m.target_type === 'quest')
                    .map((m) => query.data.quests.find((q) => q.id === m.target_id)?.title)
                    .filter((t): t is string => !!t)}
                  onEdit={() => setEditing(k)}
                  courseId={courseId}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function CompetencyRow({
  competency: k,
  parent,
  questTitles,
  onEdit,
  courseId,
}: {
  competency: Competency;
  parent?: Competency;
  questTitles: string[];
  onEdit: () => void;
  courseId: string;
}) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => deleteCompetency(k.id),
    onSuccess: () => {
      toast.success('ลบสมรรถนะแล้ว');
      void queryClient.invalidateQueries({ queryKey: ['competency', 'manage', courseId] });
    },
    onError: () => toast.error('ลบไม่สำเร็จ'),
  });
  return (
    <li>
      <Card className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">
            {k.code}
            {parent && ` · ภายใต้ ${parent.code}`} · เกณฑ์ผ่าน {k.pass_threshold}%
          </p>
          <h2 className="font-semibold">{k.name}</h2>
          {k.description && <p className="text-sm text-muted-foreground">{k.description}</p>}
          <p className="text-xs">
            หลักฐานจากภารกิจ: {questTitles.length ? questTitles.join(', ') : 'ยังไม่ผูก'}
          </p>
        </div>
        <div className="flex">
          <Button variant="ghost" size="icon" aria-label={`แก้ไข ${k.code}`} onClick={onEdit}>
            <Pencil aria-hidden />
          </Button>
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="icon" aria-label={`ลบ ${k.code}`}>
                <Trash2 aria-hidden />
              </Button>
            }
            title={`ลบสมรรถนะ ${k.code}?`}
            description="ผลการประเมินสมรรถนะนี้ของนักเรียนทุกคนจะถูกลบด้วย"
            confirmLabel="ลบ"
            destructive
            onConfirm={() => remove.mutate()}
          />
        </div>
      </Card>
    </li>
  );
}

function CompetencyForm({
  courseId,
  competency,
  all,
  quests,
  mappedQuestIds,
  onDone,
}: {
  courseId: string;
  competency: Competency | null;
  all: Competency[];
  quests: { id: string; title: string }[];
  mappedQuestIds: string[];
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState(competency?.code ?? `C${all.length + 1}`);
  const [name, setName] = useState(competency?.name ?? '');
  const [description, setDescription] = useState(competency?.description ?? '');
  const [parentId, setParentId] = useState(competency?.parent_id ?? '');
  const [threshold, setThreshold] = useState(competency?.pass_threshold ?? 60);
  const [questIds, setQuestIds] = useState<string[]>(mappedQuestIds);

  const save = useMutation({
    mutationFn: async () => {
      await saveCompetency(courseId, competency?.id ?? null, {
        code: code.trim(),
        name: name.trim(),
        description: description.trim(),
        parent_id: parentId || null,
        pass_threshold: threshold,
        position: competency?.position ?? all.length + 1,
      });
      const id =
        competency?.id ??
        (await listCompetencies(courseId)).find((k) => k.code === code.trim())?.id;
      if (id) await setQuestMappings(courseId, id, questIds);
    },
    onSuccess: () => {
      toast.success('บันทึกสมรรถนะแล้ว');
      void queryClient.invalidateQueries({ queryKey: ['competency'] });
      onDone();
    },
    onError: (e) =>
      toast.error((e as { code?: string }).code === '23505' ? 'รหัสสมรรถนะซ้ำ' : 'บันทึกไม่สำเร็จ'),
  });
  const valid = code.trim() && name.trim() && threshold >= 0 && threshold <= 100;

  return (
    <Card>
      <form
        className="grid gap-4 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) save.mutate();
        }}
      >
        <h2 className="text-lg font-semibold sm:col-span-4">
          {competency ? `แก้ไข ${competency.code}` : 'เพิ่มสมรรถนะ'}
        </h2>
        <div className="space-y-1.5">
          <label htmlFor="k-code" className="block text-sm font-medium">
            รหัส
          </label>
          <input
            id="k-code"
            value={code}
            maxLength={20}
            onChange={(e) => setCode(e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div className="space-y-1.5 sm:col-span-3">
          <label htmlFor="k-name" className="block text-sm font-medium">
            ชื่อสมรรถนะ
          </label>
          <input
            id="k-name"
            value={name}
            maxLength={200}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div className="space-y-1.5 sm:col-span-4">
          <label htmlFor="k-desc" className="block text-sm font-medium">
            คำอธิบาย / พฤติกรรมบ่งชี้
          </label>
          <textarea
            id="k-desc"
            value={description}
            maxLength={2000}
            rows={2}
            onChange={(e) => setDescription(e.target.value)}
            className={`${inputClass} py-2`}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="k-parent" className="block text-sm font-medium">
            สมรรถนะหลัก (Skill Tree)
          </label>
          <select
            id="k-parent"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className={inputClass}
          >
            <option value="">ไม่มี (ระดับบนสุด)</option>
            {all
              .filter((k) => k.id !== competency?.id)
              .map((k) => (
                <option key={k.id} value={k.id}>
                  {k.code} {k.name}
                </option>
              ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="k-threshold" className="block text-sm font-medium">
            เกณฑ์ผ่าน (%)
          </label>
          <input
            id="k-threshold"
            type="number"
            min={0}
            max={100}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className={inputClass}
          />
        </div>
        {quests.length > 0 && (
          <fieldset className="space-y-2 sm:col-span-4">
            <legend className="text-sm font-medium">ภารกิจที่ใช้เป็นหลักฐาน (ใช้คะแนนรวมของภารกิจ)</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {quests.map((q) => (
                <label key={q.id} className="inline-flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={questIds.includes(q.id)}
                    className="size-5 accent-[var(--primary)]"
                    onChange={(e) =>
                      setQuestIds((p) =>
                        e.target.checked ? [...p, q.id] : p.filter((x) => x !== q.id),
                      )
                    }
                  />
                  {q.title}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="flex gap-2 sm:col-span-4 sm:justify-end">
          <Button type="button" variant="outline" onClick={onDone}>
            ยกเลิก
          </Button>
          <Button type="submit" disabled={!valid || save.isPending}>
            บันทึก
          </Button>
        </div>
      </form>
    </Card>
  );
}

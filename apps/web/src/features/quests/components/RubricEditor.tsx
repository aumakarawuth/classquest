import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { inputClass } from '@/components/ui/field-utils';
import { getRubricCriteria, saveQuestRubric, type CriterionInput } from '../reviewApi';

/** Criteria editor for one quest. Saving replaces the criteria atomically on the server. */
export function RubricEditor({ questId, rubricId }: { questId: string; rubricId: string | null }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['rubric', rubricId],
    queryFn: () => getRubricCriteria(rubricId ?? ''),
    enabled: !!rubricId,
  });
  if (rubricId && query.isPending)
    return (
      <Card>
        <p className="text-sm text-muted-foreground">กำลังโหลดเกณฑ์…</p>
      </Card>
    );
  const initial: CriterionInput[] =
    query.data?.map((c) => ({
      name: c.name,
      description: c.description,
      max_points: c.max_points,
    })) ?? [];
  return (
    <RubricForm
      key={rubricId ?? 'none'}
      initial={initial}
      onSaved={() => void queryClient.invalidateQueries({ queryKey: ['quests'] })}
      questId={questId}
    />
  );
}

function RubricForm({
  questId,
  initial,
  onSaved,
}: {
  questId: string;
  initial: CriterionInput[];
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<CriterionInput[]>(initial);
  const total = rows.reduce(
    (sum, r) => sum + (Number.isFinite(r.max_points) ? r.max_points : 0),
    0,
  );
  const invalid = rows.some((r) => !r.name.trim() || !(r.max_points > 0));

  const save = useMutation({
    mutationFn: () =>
      saveQuestRubric(
        questId,
        rows.map((r) => ({ ...r, name: r.name.trim() })),
      ),
    onSuccess: () => {
      toast.success(rows.length ? 'บันทึกเกณฑ์การให้คะแนนแล้ว' : 'ยกเลิกการใช้ Rubric แล้ว');
      onSaved();
    },
    onError: () => toast.error('บันทึกเกณฑ์ไม่สำเร็จ'),
  });
  const update = (i: number, patch: Partial<CriterionInput>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">เกณฑ์การให้คะแนน (Rubric)</h2>
        <p className="text-sm text-muted-foreground">
          คะแนนรวมจาก Rubric จะถูกปรับเทียบกับคะแนนเต็มของภารกิจ หากเกณฑ์ถูกใช้ตรวจแล้ว
          ระบบจะบันทึกเป็นเกณฑ์ฉบับใหม่
        </p>
      </div>
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">ยังไม่มีเกณฑ์ (ครูให้คะแนนรวมโดยตรง)</p>
      )}
      <ol className="space-y-3">
        {rows.map((r, i) => (
          <li key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_7rem_auto]">
            <div className="space-y-2">
              <label className="sr-only" htmlFor={`crit-name-${i}`}>
                ชื่อเกณฑ์ที่ {i + 1}
              </label>
              <input
                id={`crit-name-${i}`}
                value={r.name}
                maxLength={200}
                placeholder={`เกณฑ์ที่ ${i + 1} เช่น ต่อวงจรถูกต้อง`}
                onChange={(e) => update(i, { name: e.target.value })}
                className={inputClass}
              />
              <label className="sr-only" htmlFor={`crit-desc-${i}`}>
                คำอธิบายเกณฑ์ที่ {i + 1}
              </label>
              <input
                id={`crit-desc-${i}`}
                value={r.description}
                maxLength={2000}
                placeholder="คำอธิบาย (ไม่บังคับ)"
                onChange={(e) => update(i, { description: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground" htmlFor={`crit-max-${i}`}>
                คะแนนเต็ม
              </label>
              <input
                id={`crit-max-${i}`}
                type="number"
                min={0.5}
                step={0.5}
                value={Number.isFinite(r.max_points) ? r.max_points : ''}
                onChange={(e) => update(i, { max_points: Number(e.target.value) })}
                className={inputClass}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`ลบเกณฑ์ที่ ${i + 1}`}
              className="self-end"
              onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
            >
              <Trash2 aria-hidden />
            </Button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={rows.length >= 20}
          onClick={() => setRows((prev) => [...prev, { name: '', description: '', max_points: 4 }])}
        >
          <Plus aria-hidden />
          เพิ่มเกณฑ์
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground tabular-nums">รวม {total} คะแนน</span>
          <Button type="button" onClick={() => save.mutate()} disabled={invalid || save.isPending}>
            บันทึกเกณฑ์
          </Button>
        </div>
      </div>
    </Card>
  );
}

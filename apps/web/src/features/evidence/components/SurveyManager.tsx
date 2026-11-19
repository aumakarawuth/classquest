import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { inputClass } from '@/components/ui/field-utils';
import {
  likertLevel,
  listSurveys,
  saveSurvey,
  surveySummary,
  type Survey,
  type SurveyItem,
} from '../api';

const defaultItems: SurveyItem[] = [
  { id: 'q1', text: 'กิจกรรมการเรียนรู้แบบภารกิจ (Quest) ช่วยให้ฉันอยากเรียนมากขึ้น', type: 'likert' },
  { id: 'q2', text: 'Virtual Lab ช่วยให้ฉันเข้าใจการต่อวงจรและเขียนโปรแกรม', type: 'likert' },
  { id: 'q3', text: 'XP และ Badge ช่วยกระตุ้นให้ฉันทำงานให้สำเร็จ', type: 'likert' },
  { id: 'q4', text: 'ฉันสามารถติดตามความก้าวหน้าของตนเองได้', type: 'likert' },
  { id: 'q5', text: 'ข้อเสนอแนะเพิ่มเติม', type: 'text' },
];

export function SurveyManager({ courseId }: { courseId: string }) {
  const surveys = useQuery({
    queryKey: ['surveys', courseId],
    queryFn: () => listSurveys(courseId),
  });
  const [editing, setEditing] = useState<Survey | 'new' | null>(null);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          แบบประเมินมาตรประมาณค่า 5 ระดับ ผลแสดงเป็นค่าเฉลี่ยและส่วนเบี่ยงเบนมาตรฐาน
          (แบบไม่ระบุตัวตนครูเห็นเฉพาะผลรวม)
        </p>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus aria-hidden />
          สร้างแบบประเมิน
        </Button>
      </div>
      {editing && (
        <SurveyForm
          key={editing === 'new' ? 'new' : editing.id}
          courseId={courseId}
          survey={editing === 'new' ? null : editing}
          onDone={() => setEditing(null)}
        />
      )}
      {surveys.data?.map((s) => (
        <Card key={s.id} className="space-y-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">{s.title}</h3>
            <div className="flex gap-2 text-xs">
              <span className="rounded-full bg-muted px-2 py-0.5">
                {s.open ? 'เปิดรับคำตอบ' : 'ปิด'}
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5">
                {s.anonymous ? 'ไม่ระบุตัวตน' : 'ระบุตัวตน'}
              </span>
              <Button variant="outline" size="sm" onClick={() => setEditing(s)}>
                แก้ไข
              </Button>
            </div>
          </div>
          <SurveyResults surveyId={s.id} />
        </Card>
      ))}
    </div>
  );
}

export function SurveyResults({ surveyId }: { surveyId: string }) {
  const q = useQuery({
    queryKey: ['survey-summary', surveyId],
    queryFn: () => surveySummary(surveyId),
  });
  if (!q.data) return <p className="text-sm text-muted-foreground">กำลังโหลดผล…</p>;
  const s = q.data;
  return (
    <div className="space-y-2 text-sm">
      <p>
        ผู้ตอบ {s.respondents}/{s.enrolled} คน
      </p>
      <table className="w-full">
        <caption className="sr-only">ผลแบบประเมิน {s.title}</caption>
        <thead>
          <tr className="border-b text-left">
            <th scope="col" className="py-1">
              รายการ
            </th>
            <th scope="col" className="py-1 text-right">
              x̄
            </th>
            <th scope="col" className="py-1 text-right">
              S.D.
            </th>
            <th scope="col" className="py-1 text-right">
              ระดับ
            </th>
          </tr>
        </thead>
        <tbody>
          {s.items
            ?.filter((i) => i.type === 'likert')
            .map((i) => (
              <tr key={i.id} className="border-b last:border-0">
                <th scope="row" className="py-1 text-left font-normal">
                  {i.text}
                </th>
                <td className="py-1 text-right tabular-nums">{i.mean ?? '–'}</td>
                <td className="py-1 text-right tabular-nums">{i.sd ?? '–'}</td>
                <td className="py-1 text-right">{likertLevel(i.mean)}</td>
              </tr>
            ))}
        </tbody>
      </table>
      {s.items
        ?.filter((i) => i.type === 'text')
        .map((i) => (
          <details key={i.id}>
            <summary className="cursor-pointer">
              {i.text} ({i.answers?.length ?? 0} คำตอบ)
            </summary>
            <ul className="mt-1 list-disc pl-6">
              {i.answers?.map((a, n) => (
                <li key={n}>{a}</li>
              ))}
            </ul>
          </details>
        ))}
    </div>
  );
}

function SurveyForm({
  courseId,
  survey,
  onDone,
}: {
  courseId: string;
  survey: Survey | null;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(survey?.title ?? 'แบบประเมินความพึงพอใจต่อการจัดการเรียนรู้');
  const [items, setItems] = useState<SurveyItem[]>(survey?.items ?? defaultItems);
  const [anonymous, setAnonymous] = useState(survey?.anonymous ?? true);
  const [open, setOpen] = useState(survey?.open ?? false);
  const save = useMutation({
    mutationFn: () =>
      saveSurvey(courseId, survey?.id ?? null, {
        title: title.trim(),
        description: '',
        items: items.filter((i) => i.text.trim()),
        anonymous,
        open,
      }),
    onSuccess: () => {
      toast.success('บันทึกแบบประเมินแล้ว');
      void queryClient.invalidateQueries({ queryKey: ['surveys', courseId] });
      onDone();
    },
    onError: () => toast.error('บันทึกไม่สำเร็จ'),
  });
  const nextId = () => `q${Math.max(0, ...items.map((i) => Number(i.id.slice(1)) || 0)) + 1}`;
  return (
    <Card className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="sv-title" className="block text-sm font-medium">
          ชื่อแบบประเมิน
        </label>
        <input
          id="sv-title"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
        />
      </div>
      <ol className="space-y-2">
        {items.map((it, i) => (
          <li key={it.id} className="flex gap-2">
            <label className="sr-only" htmlFor={`sv-item-${it.id}`}>
              ข้อ {i + 1}
            </label>
            <input
              id={`sv-item-${it.id}`}
              value={it.text}
              onChange={(e) =>
                setItems(items.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)))
              }
              className={inputClass}
            />
            <label className="sr-only" htmlFor={`sv-type-${it.id}`}>
              ประเภทข้อ {i + 1}
            </label>
            <select
              id={`sv-type-${it.id}`}
              value={it.type}
              onChange={(e) =>
                setItems(
                  items.map((x) =>
                    x.id === it.id ? { ...x, type: e.target.value as SurveyItem['type'] } : x,
                  ),
                )
              }
              className={`${inputClass} w-36`}
            >
              <option value="likert">5 ระดับ</option>
              <option value="text">ข้อความ</option>
            </select>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`ลบข้อ ${i + 1}`}
              onClick={() => setItems(items.filter((x) => x.id !== it.id))}
            >
              <Trash2 aria-hidden />
            </Button>
          </li>
        ))}
      </ol>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setItems([...items, { id: nextId(), text: '', type: 'likert' }])}
      >
        <Plus aria-hidden />
        เพิ่มข้อ
      </Button>
      <div className="flex flex-wrap gap-x-6">
        <label className="inline-flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            className="size-5 accent-[var(--primary)]"
          />
          ไม่ระบุตัวตน
        </label>
        <label className="inline-flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={open}
            onChange={(e) => setOpen(e.target.checked)}
            className="size-5 accent-[var(--primary)]"
          />
          เปิดให้นักเรียนตอบ
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>
          ยกเลิก
        </Button>
        <Button
          onClick={() => save.mutate()}
          disabled={!title.trim() || !items.some((i) => i.text.trim()) || save.isPending}
        >
          บันทึก
        </Button>
      </div>
    </Card>
  );
}

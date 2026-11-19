import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/field-utils';
import type { Competency } from '@/features/competency/api';
import {
  questionTypeLabels,
  questionTypes,
  validateQuestion,
  type QuestionInput,
  type QuestionType,
} from '../api';
import { emptyQuestion } from '../questionUtils';

const tfOptions = [
  { label: 'จริง', is_correct: true },
  { label: 'เท็จ', is_correct: false },
];

interface Props {
  initial: QuestionInput;
  competencies: Competency[];
  saving: boolean;
  onSave: (q: QuestionInput) => void;
  onCancel: () => void;
}

export function QuestionEditor({ initial, competencies, saving, onSave, onCancel }: Props) {
  const [q, setQ] = useState<QuestionInput>(initial);
  const [touched, setTouched] = useState(false);
  const error = validateQuestion(q);
  const set = (patch: Partial<QuestionInput>) => setQ((p) => ({ ...p, ...patch }));
  const setType = (type: QuestionType) =>
    set({
      type,
      options:
        type === 'tf'
          ? tfOptions
          : type === 'short'
            ? [{ label: '', is_correct: true }]
            : emptyQuestion().options,
    });
  const setOption = (i: number, patch: Partial<QuestionInput['options'][number]>) =>
    set({ options: q.options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)) });
  const markCorrect = (i: number) =>
    set({ options: q.options.map((o, idx) => ({ ...o, is_correct: idx === i })) });

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!error) onSave({ ...q, stem: q.stem.trim(), bank_tag: q.bank_tag.trim() });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="qe-type" className="block text-sm font-medium">
            ประเภทคำถาม
          </label>
          <select
            id="qe-type"
            value={q.type}
            onChange={(e) => setType(e.target.value as QuestionType)}
            className={inputClass}
          >
            {questionTypes.map((t) => (
              <option key={t} value={t}>
                {questionTypeLabels[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="qe-points" className="block text-sm font-medium">
            คะแนน
          </label>
          <input
            id="qe-points"
            type="number"
            min={0.5}
            step={0.5}
            value={q.points}
            onChange={(e) => set({ points: Number(e.target.value) })}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="qe-tag" className="block text-sm font-medium">
            หมวดในคลังข้อสอบ
          </label>
          <input
            id="qe-tag"
            value={q.bank_tag}
            maxLength={60}
            placeholder="เช่น หน่วย 1"
            onChange={(e) => set({ bank_tag: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>
      <div className="space-y-1">
        <label htmlFor="qe-stem" className="block text-sm font-medium">
          คำถาม
        </label>
        <textarea
          id="qe-stem"
          value={q.stem}
          maxLength={5000}
          rows={3}
          onChange={(e) => set({ stem: e.target.value })}
          className={`${inputClass} py-2`}
        />
      </div>

      {q.type === 'short' ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">
            คำตอบที่ยอมรับ (ตรวจอัตโนมัติแบบไม่สนตัวพิมพ์/ช่องว่าง; เว้นว่างทั้งหมด = ครูตรวจเอง)
          </legend>
          {q.options.map((o, i) => (
            <div key={i} className="flex gap-2">
              <label className="sr-only" htmlFor={`qe-ans-${i}`}>
                คำตอบที่ยอมรับ {i + 1}
              </label>
              <input
                id={`qe-ans-${i}`}
                value={o.label}
                maxLength={1000}
                onChange={(e) => setOption(i, { label: e.target.value, is_correct: true })}
                className={inputClass}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`ลบคำตอบ ${i + 1}`}
                onClick={() => set({ options: q.options.filter((_, idx) => idx !== i) })}
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={q.options.length >= 10}
            onClick={() => set({ options: [...q.options, { label: '', is_correct: true }] })}
          >
            <Plus aria-hidden />
            เพิ่มคำตอบที่ยอมรับ
          </Button>
        </fieldset>
      ) : (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">
            {q.type === 'tf' ? 'คำตอบที่ถูกต้อง' : 'ตัวเลือก (เลือกวงกลมหน้าคำตอบที่ถูก)'}
          </legend>
          {q.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name="qe-correct"
                checked={o.is_correct}
                onChange={() => markCorrect(i)}
                aria-label={`ตัวเลือก ${i + 1} ถูกต้อง`}
                className="size-5 shrink-0 accent-[var(--success)]"
              />
              {q.type === 'tf' ? (
                <span className="text-sm">{o.label}</span>
              ) : (
                <>
                  <label className="sr-only" htmlFor={`qe-opt-${i}`}>
                    ตัวเลือก {i + 1}
                  </label>
                  <input
                    id={`qe-opt-${i}`}
                    value={o.label}
                    maxLength={1000}
                    onChange={(e) => setOption(i, { label: e.target.value })}
                    className={inputClass}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`ลบตัวเลือก ${i + 1}`}
                    disabled={q.options.length <= 2}
                    onClick={() => {
                      const next = q.options.filter((_, idx) => idx !== i);
                      if (!next.some((x) => x.is_correct) && next[0])
                        next[0] = { ...next[0], is_correct: true };
                      set({ options: next });
                    }}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </>
              )}
            </div>
          ))}
          {q.type === 'mc' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={q.options.length >= 8}
              onClick={() => set({ options: [...q.options, { label: '', is_correct: false }] })}
            >
              <Plus aria-hidden />
              เพิ่มตัวเลือก
            </Button>
          )}
        </fieldset>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="qe-expl" className="block text-sm font-medium">
            คำอธิบายเฉลย (แสดงหลังถึงเวลาเฉลย)
          </label>
          <textarea
            id="qe-expl"
            value={q.explanation}
            maxLength={5000}
            rows={2}
            onChange={(e) => set({ explanation: e.target.value })}
            className={`${inputClass} py-2`}
          />
        </div>
        {competencies.length > 0 && (
          <div className="space-y-1">
            <label htmlFor="qe-comp" className="block text-sm font-medium">
              สมรรถนะที่วัด
            </label>
            <select
              id="qe-comp"
              value={q.competency_id ?? ''}
              onChange={(e) => set({ competency_id: e.target.value || null })}
              className={inputClass}
            >
              <option value="">ไม่ระบุ</option>
              {competencies.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.code} {k.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {touched && error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          ยกเลิก
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'กำลังบันทึก…' : 'บันทึกคำถาม'}
        </Button>
      </div>
    </form>
  );
}

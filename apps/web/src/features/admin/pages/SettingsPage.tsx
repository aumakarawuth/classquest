import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { inputClass } from '@/components/ui/field-utils';
import { useAuth } from '@/features/auth/useAuth';
import { listSettings, parseDomains, updateSetting, type Setting } from '../opsApi';

const flags: { key: string; label: string; hint: string; available: boolean }[] = [
  {
    key: 'feature.leaderboard',
    label: 'Leaderboard',
    hint: 'ครูต้องเปิดในรายวิชาด้วย นักเรียนต้องเลือกเข้าร่วมเอง',
    available: true,
  },
  {
    key: 'feature.wokwi_embed',
    label: 'ฝัง Wokwi ในหน้า',
    hint: 'ปิดไว้จนกว่าจะทดสอบว่า Wokwi อนุญาตการฝัง',
    available: true,
  },
  {
    key: 'feature.ai_tutor',
    label: 'AI Tutor',
    hint: 'ยังไม่พัฒนา (Phase 7) — เปิดแล้วจะยังไม่มีผล',
    available: false,
  },
  {
    key: 'feature.classroom_api',
    label: 'Google Classroom API',
    hint: 'ยังไม่พัฒนา (Phase 7) — ใช้แบบลิงก์/CSV',
    available: false,
  },
];

export default function SettingsPage() {
  const q = useQuery({ queryKey: ['admin', 'settings'], queryFn: listSettings });
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">ตั้งค่าระบบ</h1>
      {q.isPending ? (
        <PageSkeleton />
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : (
        <>
          <Card className="space-y-3">
            <h2 className="font-semibold">ฟีเจอร์</h2>
            {flags.map((f) => (
              <FlagRow key={f.key} flag={f} setting={q.data.find((s) => s.key === f.key)} />
            ))}
          </Card>
          <DomainsCard setting={q.data.find((s) => s.key === 'auth.allowed_email_domains')} />
          <XpCard setting={q.data.find((s) => s.key === 'xp.lesson_complete')} />
        </>
      )}
    </div>
  );
}

function useSave() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      updateSetting(key, value, userId ?? ''),
    onSuccess: () => {
      toast.success('บันทึกแล้ว');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
    onError: () => toast.error('บันทึกไม่สำเร็จ'),
  });
}

function FlagRow({ flag, setting }: { flag: (typeof flags)[number]; setting?: Setting }) {
  const save = useSave();
  const on = setting?.value === true;
  return (
    <label className="flex min-h-11 items-start gap-3">
      <input
        type="checkbox"
        checked={on}
        disabled={!setting || save.isPending || (!flag.available && !on)}
        onChange={(e) => save.mutate({ key: flag.key, value: e.target.checked })}
        className="mt-1 size-5 accent-[var(--primary)]"
      />
      <span>
        <span className="block text-sm font-medium">{flag.label}</span>
        <span className="block text-xs text-muted-foreground">{flag.hint}</span>
      </span>
    </label>
  );
}

function DomainsCard({ setting }: { setting?: Setting }) {
  const save = useSave();
  const current = Array.isArray(setting?.value) ? (setting.value as string[]) : [];
  const [text, setText] = useState(current.join('\n'));
  const parsed = parseDomains(text);
  return (
    <Card className="space-y-2">
      <h2 className="font-semibold">โดเมนอีเมลที่อนุญาตให้สมัคร</h2>
      <p className="text-xs text-muted-foreground">
        ตรวจที่ฐานข้อมูลตอนสร้างบัญชี (ADR-0006) เว้นว่าง = ไม่จำกัด (ไม่แนะนำในการใช้งานจริง)
      </p>
      <label htmlFor="domains" className="sr-only">
        โดเมนที่อนุญาต
      </label>
      <textarea
        id="domains"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="school.ac.th"
        className={`${inputClass} py-2 font-mono`}
      />
      {parsed.invalid.length > 0 && (
        <p role="alert" className="text-xs text-destructive">
          รูปแบบไม่ถูกต้อง: {parsed.invalid.join(', ')}
        </p>
      )}
      <Button
        onClick={() => save.mutate({ key: 'auth.allowed_email_domains', value: parsed.domains })}
        disabled={parsed.invalid.length > 0 || save.isPending}
      >
        บันทึก
      </Button>
    </Card>
  );
}

function XpCard({ setting }: { setting?: Setting }) {
  const save = useSave();
  const [v, setV] = useState(String(typeof setting?.value === 'number' ? setting.value : 10));
  const n = Number(v);
  const valid = Number.isInteger(n) && n >= 0 && n <= 1000;
  return (
    <Card className="space-y-2">
      <h2 className="font-semibold">XP เมื่อเรียนบทเรียนจบ</h2>
      <div className="flex gap-2">
        <label htmlFor="xp-lesson" className="sr-only">
          XP ต่อบทเรียน
        </label>
        <input
          id="xp-lesson"
          type="number"
          min={0}
          max={1000}
          value={v}
          onChange={(e) => setV(e.target.value)}
          className={`${inputClass} w-32`}
        />
        <Button
          onClick={() => save.mutate({ key: 'xp.lesson_complete', value: n })}
          disabled={!valid || save.isPending}
        >
          บันทึก
        </Button>
      </div>
    </Card>
  );
}

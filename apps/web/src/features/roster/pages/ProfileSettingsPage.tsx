import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { inputClass } from '@/components/ui/field-utils';
import { useAuth } from '@/features/auth/useAuth';
import { updateMyProfile } from '../api';

const roleLabels: Record<string, string> = {
  student: 'นักเรียน',
  teacher: 'ครูผู้สอน',
  admin: 'ผู้ดูแลระบบ',
};

/** Own profile: only cosmetic fields are writable (column grants in the database enforce this). */
export default function ProfileSettingsPage({ title = 'ตั้งค่า' }: { title?: string }) {
  const { userId, account, refetchAccount } = useAuth();
  const [name, setName] = useState(account?.displayName ?? '');
  const [error, setError] = useState<string>();
  const save = useMutation({
    mutationFn: () => updateMyProfile(userId ?? '', { display_name: name.trim(), nickname: null }),
    onSuccess: () => {
      toast.success('บันทึกแล้ว');
      void refetchAccount();
    },
    onError: () => toast.error('บันทึกไม่สำเร็จ'),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (n.length < 1 || n.length > 120) return setError('ชื่อต้องยาว 1–120 ตัวอักษร');
    setError(undefined);
    save.mutate();
  };
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      <Card className="space-y-4">
        <h2 className="font-semibold">บัญชีของฉัน</h2>
        <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
          <dt className="text-muted-foreground">อีเมล</dt>
          <dd>{account?.email}</dd>
          <dt className="text-muted-foreground">บทบาท</dt>
          <dd>{account?.roles.map((r) => roleLabels[r] ?? r).join(', ')}</dd>
        </dl>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field id="p-name" label="ชื่อที่แสดง" error={error} hint="ชื่อนี้แสดงให้ครูและเพื่อนในรายวิชาเห็น">
            <input
              id="p-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              aria-invalid={!!error}
              aria-describedby={error ? 'p-name-error' : 'p-name-hint'}
              maxLength={120}
            />
          </Field>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'กำลังบันทึก…' : 'บันทึก'}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          อีเมล รหัสนักศึกษา และบทบาท แก้ได้โดยผู้ดูแลระบบเท่านั้น
        </p>
      </Card>
    </div>
  );
}

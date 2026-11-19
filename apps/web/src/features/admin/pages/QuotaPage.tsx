import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatThaiDateTime } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import { formatBytes, getQuota } from '../opsApi';

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
  return (
    <Card className="space-y-2 p-4">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <Progress
        value={used}
        max={limit}
        label={label}
        barClassName={cn(pct >= 80 ? 'bg-destructive' : pct >= 60 ? 'bg-warning' : 'bg-success')}
      />
      <p className="text-xs text-muted-foreground">
        {formatBytes(used)} จาก {formatBytes(limit)}
        {pct >= 80 && ' — ใกล้เต็ม ควรตรวจสอบ'}
      </p>
    </Card>
  );
}

export default function QuotaPage() {
  const q = useQuery({ queryKey: ['admin', 'quota'], queryFn: getQuota });
  if (q.isPending) return <PageSkeleton />;
  if (q.isError) return <ErrorState onRetry={() => void q.refetch()} />;
  const d = q.data;
  const counts: [string, number][] = [
    ['ผู้ใช้ทั้งหมด', d.users],
    ['ใช้งานใน 30 วัน', d.active_users_30d],
    ['รายวิชา', d.courses],
    ['งานที่ส่ง', d.submissions],
    ['การทำแบบทดสอบ', d.quiz_attempts],
    ['รายการ XP', d.xp_transactions],
    ['Audit Log', d.audit_logs],
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">โควตาบริการ</h1>
        <p className="text-sm text-muted-foreground">
          เทียบกับ Supabase Free Tier (ปรับขีดจำกัดได้ในตั้งค่าระบบหากเงื่อนไขทางการเปลี่ยน)
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Meter label="ฐานข้อมูล" used={d.db_bytes} limit={d.limits.db_bytes} />
        <Meter label="ที่เก็บไฟล์ (Storage)" used={d.storage_bytes} limit={d.limits.storage_bytes} />
      </div>
      <Card className="space-y-2 p-4 text-sm">
        <p className="font-medium">ปริมาณข้อมูลขาออก (Egress) และ MAU</p>
        <p className="text-muted-foreground">
          Supabase ไม่มี API ฟรีสำหรับอ่านค่าเหล่านี้ ตรวจได้ที่ Supabase Dashboard › Usage (ขีดจำกัด{' '}
          {formatBytes(d.limits.egress_bytes_month)}/เดือน, {d.limits.mau.toLocaleString('th-TH')}{' '}
          MAU)
        </p>
        <a
          href="https://supabase.com/dashboard/project/_/settings/billing/usage"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary underline"
        >
          <ExternalLink className="size-4" aria-hidden />
          เปิด Supabase Usage
        </a>
      </Card>
      <Card className="p-4 text-sm">
        <p>
          <span className="font-medium">สำรองข้อมูลล่าสุด:</span>{' '}
          {d.last_backup_at
            ? formatThaiDateTime(d.last_backup_at)
            : 'ยังไม่เคย (ตั้งค่า GitHub Actions ตาม DEPLOYMENT.md)'}
        </p>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-2 font-semibold">จำนวนข้อมูล</h2>
          <dl className="space-y-1 text-sm">
            {counts.map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="tabular-nums">{v.toLocaleString('th-TH')}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card className="p-4">
          <h2 className="mb-2 font-semibold">ตารางที่ใหญ่ที่สุด</h2>
          <ul className="space-y-1 text-sm">
            {d.largest_tables?.map((t) => (
              <li key={t.name} className="flex justify-between">
                <span className="font-mono">{t.name}</span>
                <span className="tabular-nums">{formatBytes(t.bytes)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

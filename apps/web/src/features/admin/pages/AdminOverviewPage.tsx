import { useQuery } from '@tanstack/react-query';
import { Database, HardDrive, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatThaiDateTime } from '@/lib/datetime';
import { listUsers } from '../api';
import { formatBytes, getQuota } from '../opsApi';

export default function AdminOverviewPage() {
  const quota = useQuery({ queryKey: ['admin', 'quota'], queryFn: getQuota });
  const pending = useQuery({
    queryKey: ['admin', 'users', { status: 'pending', search: '', page: 0 }],
    queryFn: () => listUsers({ status: 'pending', search: '', page: 0 }),
  });
  const q = quota.data;
  const tile = (Icon: typeof Users, label: string, value: string, to: string, cta: string) => (
    <Card className="space-y-2 p-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" aria-hidden />
        {label}
      </p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <Link to={to} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
        {cta}
      </Link>
    </Card>
  );
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">ภาพรวมระบบ</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tile(
          Users,
          'บัญชีรออนุมัติ',
          pending.data ? String(pending.data.total) : '…',
          '/admin/users',
          'อนุมัติผู้ใช้',
        )}
        {tile(Database, 'ฐานข้อมูล', q ? formatBytes(q.db_bytes) : '…', '/admin/quota', 'ดูโควตา')}
        {tile(
          HardDrive,
          'ที่เก็บไฟล์',
          q ? formatBytes(q.storage_bytes) : '…',
          '/admin/quota',
          'ดูโควตา',
        )}
        {tile(
          ShieldCheck,
          'สำรองข้อมูลล่าสุด',
          q ? (q.last_backup_at ? formatThaiDateTime(q.last_backup_at) : 'ยังไม่เคย') : '…',
          '/admin/backup',
          'สำรอง/ส่งออก',
        )}
      </div>
    </div>
  );
}

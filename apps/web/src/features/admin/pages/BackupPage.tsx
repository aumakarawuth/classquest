import { useMutation } from '@tanstack/react-query';
import { Download, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { downloadText } from '@/features/classroom/csv';
import { exportAll } from '../opsApi';

export default function BackupPage() {
  const exp = useMutation({
    mutationFn: exportAll,
    onSuccess: (data) => {
      downloadText(
        `classquest-export-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(data, null, 2),
        'application/json',
      );
      toast.success('ดาวน์โหลดข้อมูลแล้ว — เก็บไฟล์ในที่ปลอดภัย');
    },
    onError: () => toast.error('ส่งออกไม่สำเร็จ'),
  });
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">สำรองและส่งออกข้อมูล</h1>
      <Card className="space-y-3">
        <h2 className="font-semibold">ส่งออกข้อมูลทั้งหมด (JSON)</h2>
        <p className="text-sm text-muted-foreground">
          ไฟล์มีข้อมูลส่วนบุคคลของนักเรียนและครู (ชื่อ อีเมล ผลการเรียน) ต้องเก็บตามนโยบายของสถานศึกษาและ PDPA
          ห้ามเผยแพร่ ทุกการส่งออกถูกบันทึกใน Audit Log
        </p>
        <ConfirmDialog
          trigger={
            <Button disabled={exp.isPending}>
              <Download aria-hidden />
              ส่งออกข้อมูลทั้งหมด
            </Button>
          }
          title="ส่งออกข้อมูลทั้งหมด?"
          description="ไฟล์มีข้อมูลส่วนบุคคล กรุณาเก็บในที่ปลอดภัยและลบเมื่อไม่ใช้"
          confirmLabel="ส่งออก"
          onConfirm={() => exp.mutate()}
        />
      </Card>
      <Card className="space-y-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="size-5 text-success" aria-hidden />
          สำรองข้อมูลอัตโนมัติรายสัปดาห์
        </h2>
        <ul className="list-disc space-y-1 pl-6 text-sm">
          <li>
            GitHub Actions <code>backup.yml</code> ทำ <code>pg_dump</code> ทุกวันอาทิตย์ เข้ารหัสด้วย age
            และเก็บเป็น artifact 30 วัน
          </li>
          <li>
            ต้องตั้ง secret <code>SUPABASE_DB_URL</code> และ <code>BACKUP_AGE_PUBLIC_KEY</code> ใน
            GitHub (ขั้นตอนใน DEPLOYMENT.md)
          </li>
          <li>กุญแจถอดรหัส (age private key) เก็บโดยผู้ดูแลระบบเท่านั้น — ห้ามใส่ใน repository</li>
          <li>
            <code>keepalive.yml</code> ป้องกันโปรเจกต์ Supabase Free ถูกหยุดเมื่อไม่มีการใช้งาน
          </li>
          <li>ซ้อมกู้คืนข้อมูลทุกต้นภาคเรียน</li>
        </ul>
      </Card>
    </div>
  );
}

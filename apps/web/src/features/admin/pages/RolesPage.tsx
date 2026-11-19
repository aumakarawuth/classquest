import { Link } from 'react-router-dom';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { AppRole } from '@/features/auth/access';
import { roleLabels } from '../labels';

const permissions: { label: string; roles: AppRole[] }[] = [
  { label: 'เรียน ทำภารกิจ ทำแบบทดสอบ ดูความก้าวหน้าของตนเอง', roles: ['student'] },
  { label: 'สร้างและจัดการรายวิชาที่ตนสอน', roles: ['teacher'] },
  { label: 'ตรวจงาน ให้คะแนน ประเมินสมรรถนะ (เฉพาะวิชาที่สอน)', roles: ['teacher'] },
  { label: 'อนุมัติบัญชีและกำหนดสิทธิ์ผู้ใช้', roles: ['admin'] },
  { label: 'ดู Audit Log, ตั้งค่าระบบ, สำรองข้อมูล', roles: ['admin'] },
];
const roles: AppRole[] = ['student', 'teacher', 'admin'];

export default function RolesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">สิทธิ์การใช้งาน</h1>
        <p className="text-sm text-muted-foreground">
          บทบาทกำหนดโดยผู้ดูแลระบบเท่านั้น และบังคับใช้ที่ฐานข้อมูล (Row Level Security) ผู้ใช้หนึ่งคนมีได้หลายบทบาท
        </p>
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[32rem] text-sm">
          <caption className="sr-only">ตารางสิทธิ์ตามบทบาท</caption>
          <thead>
            <tr className="border-b text-left">
              <th scope="col" className="p-4 font-semibold">
                สิทธิ์
              </th>
              {roles.map((role) => (
                <th key={role} scope="col" className="p-4 text-center font-semibold">
                  {roleLabels[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((p) => (
              <tr key={p.label} className="border-b last:border-0">
                <th scope="row" className="p-4 text-left font-normal">
                  {p.label}
                </th>
                {roles.map((role) => (
                  <td key={role} className="p-4 text-center">
                    {p.roles.includes(role) ? (
                      <span aria-label="มีสิทธิ์" className="font-bold text-success">
                        ✓
                      </span>
                    ) : (
                      <span aria-label="ไม่มีสิทธิ์" className="text-muted-foreground">
                        –
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Link to="/admin/users" className={buttonVariants({ variant: 'outline' })}>
        ไปที่การจัดการผู้ใช้งาน
      </Link>
    </div>
  );
}

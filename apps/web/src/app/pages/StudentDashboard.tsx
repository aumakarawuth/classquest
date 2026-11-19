import { Swords } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { Link } from 'react-router-dom';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/**
 * Layout preview of the student dashboard (bento grid). Real data arrives with
 * auth + course features; until then each tile shows an honest empty state.
 */
export default function StudentDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">หน้าหลัก</h1>
        <p className="text-sm text-muted-foreground">ภาพรวมการเรียนรู้ของคุณ</p>
      </div>
      <div className="grid gap-4 md:grid-cols-6">
        <Card className="md:col-span-4">
          <h2 className="mb-2 font-semibold">ภารกิจที่กำลังทำ</h2>
          <EmptyState
            icon={Swords}
            title="ยังไม่มีภารกิจ"
            description="เมื่อเข้าร่วมรายวิชาแล้ว ภารกิจจะปรากฏที่นี่"
          />
        </Card>
        <Card className="space-y-3 md:col-span-2">
          <h2 className="font-semibold">ระดับและ XP</h2>
          <p className="text-sm text-muted-foreground">
            XP และเลเวลแยกตามรายวิชา ดูได้ในหน้ารายวิชาแต่ละวิชา
          </p>
          <Link
            to="/student/courses"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            ไปที่รายวิชาของฉัน
          </Link>
        </Card>
      </div>
    </div>
  );
}

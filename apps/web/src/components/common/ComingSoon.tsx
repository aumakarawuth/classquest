import { Construction } from 'lucide-react';
import { EmptyState } from './EmptyState';

/** Placeholder for pages planned in a later phase — never a fake working page. */
export function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <EmptyState
        icon={Construction}
        title="ฟีเจอร์นี้กำลังพัฒนา"
        description={`หน้านี้จะเปิดใช้งานใน ${phase} ตามแผนงานของโครงการ`}
      />
    </div>
  );
}

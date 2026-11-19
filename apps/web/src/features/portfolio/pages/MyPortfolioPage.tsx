import { useQuery } from '@tanstack/react-query';
import { FolderKanban } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { inputClass } from '@/components/ui/field-utils';
import { useAuth } from '@/features/auth/useAuth';
import { listMyCourses } from '@/features/courses/api';
import { PortfolioView } from '../components/PortfolioView';

export default function MyPortfolioPage() {
  const { userId, account } = useAuth();
  const courses = useQuery({
    queryKey: ['courses', 'student', userId],
    queryFn: () => listMyCourses(userId ?? '', 'student'),
    enabled: !!userId,
  });
  const [courseId, setCourseId] = useState('');
  if (courses.isPending) return <PageSkeleton />;
  if (!courses.data?.length) return <EmptyState icon={FolderKanban} title="ยังไม่ได้เข้าร่วมรายวิชา" />;
  const selected = courses.data.find((c) => c.id === courseId) ?? courses.data[0];
  if (!selected) return null;
  return (
    <div className="space-y-4">
      {courses.data.length > 1 && (
        <div className="flex items-center gap-2 print:hidden">
          <label htmlFor="pf-course" className="text-sm font-medium">
            รายวิชา
          </label>
          <select
            id="pf-course"
            value={selected.id}
            onChange={(e) => setCourseId(e.target.value)}
            className={`${inputClass} max-w-md`}
          >
            {courses.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} {c.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <PortfolioView
        key={selected.id}
        courseId={selected.id}
        userId={userId ?? ''}
        editable
        courseTitle={`${selected.code} ${selected.name}`}
        studentName={account?.displayName ?? ''}
      />
    </div>
  );
}

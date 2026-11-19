import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { getConnection } from './api';

/** "Open in Google Classroom" for students; renders nothing when the course is not linked. */
export function ClassroomLink({ courseId }: { courseId: string }) {
  const link = useQuery({
    queryKey: ['classroom', 'link', courseId],
    queryFn: () => getConnection(courseId),
  });
  if (!link.data) return null;
  return (
    <a
      href={link.data}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonVariants({ variant: 'outline' })}
    >
      <ExternalLink aria-hidden />
      เปิด Google Classroom
    </a>
  );
}

import { useQuery } from '@tanstack/react-query';
import { MessageSquareHeart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/features/auth/useAuth';
import { listSurveys, myResponses } from '../api';

/** Open surveys the student has not answered yet (shown on the course page). */
export function CourseSurveys({ courseId }: { courseId: string }) {
  const { userId } = useAuth();
  const q = useQuery({
    queryKey: ['surveys', 'student', courseId, userId],
    enabled: !!userId,
    queryFn: async () => {
      const surveys = (await listSurveys(courseId)).filter((s) => s.open);
      const done = await myResponses(
        userId ?? '',
        surveys.map((s) => s.id),
      );
      return surveys.filter((s) => !done.includes(s.id));
    },
  });
  if (!q.data?.length) return null;
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 lg:col-span-3">
      <p className="flex items-center gap-2 text-sm">
        <MessageSquareHeart className="size-5 text-accent" aria-hidden />
        ครูขอความคิดเห็นของคุณ: {q.data[0]?.title}
      </p>
      <Link to={`/student/surveys/${q.data[0]?.id}`} className={buttonVariants({ size: 'sm' })}>
        ตอบแบบประเมิน
      </Link>
    </Card>
  );
}

import { useQuery } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/features/auth/useAuth';
import { listQuizzes, quizKindLabels } from '../api';
import { listMyAttempts } from '../attemptApi';

/** Published quizzes of a course with the student's latest result (used on the course roadmap). */
export function CourseQuizzes({ courseId }: { courseId: string }) {
  const { userId } = useAuth();
  const query = useQuery({
    queryKey: ['student-quizzes', courseId, userId],
    enabled: !!userId,
    queryFn: async () => {
      const quizzes = (await listQuizzes(courseId)).filter((q) => q.published);
      const attempts = await listMyAttempts(
        userId ?? '',
        quizzes.map((q) => q.id),
      );
      return { quizzes, attempts };
    },
  });
  if (!query.data?.quizzes.length) return null;
  return (
    <Card className="space-y-3 lg:col-span-3">
      <h2 className="flex items-center gap-2 font-semibold">
        <ClipboardList className="size-5 text-secondary" aria-hidden />
        แบบทดสอบ
      </h2>
      <ul className="divide-y rounded-lg border">
        {query.data.quizzes.map((q) => {
          const last = query.data.attempts.find((a) => a.quiz_id === q.id);
          const status = !last
            ? 'ยังไม่ได้ทำ'
            : last.status === 'in_progress'
              ? 'กำลังทำ'
              : last.status === 'submitted'
                ? 'รอครูตรวจบางข้อ'
                : `${last.score}/${last.max_score} คะแนน`;
          return (
            <li key={q.id}>
              <Link
                to={`/student/quizzes/${q.id}`}
                className="flex min-h-14 items-center justify-between gap-3 p-3 hover:bg-muted/50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{q.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {quizKindLabels[q.kind]}
                  </span>
                </span>
                <span className="shrink-0 text-sm text-muted-foreground">{status}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

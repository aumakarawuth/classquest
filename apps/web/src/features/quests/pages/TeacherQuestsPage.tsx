import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Plus, Swords } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { buttonVariants } from '@/components/ui/button';
import { listCourseQuests } from '../api';
import { QuestCard } from '../components/QuestCard';

export default function TeacherQuestsPage() {
  const { courseId = '' } = useParams();
  const query = useQuery({
    queryKey: ['quests', 'course', courseId],
    queryFn: () => listCourseQuests(courseId),
  });

  return (
    <div className="space-y-6">
      <Link
        to={`/teacher/courses/${courseId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        กลับไปที่รายวิชา
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ภารกิจของรายวิชา</h1>
          <p className="text-sm text-muted-foreground">นักเรียนเห็นเฉพาะภารกิจที่เผยแพร่</p>
        </div>
        <Link to={`/teacher/courses/${courseId}/quests/new`} className={buttonVariants()}>
          <Plus aria-hidden />
          สร้างภารกิจ
        </Link>
      </div>
      {query.isPending ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <EmptyState
          icon={Swords}
          title="ยังไม่มีภารกิจ"
          description="สร้างภารกิจแรก เช่น Mission 01: Introduction to IoT"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {query.data.map((q) => (
            <QuestCard
              key={q.id}
              to={`/teacher/courses/${courseId}/quests/${q.id}`}
              title={q.title}
              type={q.type}
              difficulty={q.difficulty}
              xpReward={q.xp_reward}
              dueAt={q.due_at}
              subtitle={q.published ? 'เผยแพร่' : 'ฉบับร่าง'}
            />
          ))}
        </div>
      )}
    </div>
  );
}

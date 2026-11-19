import { useQuery } from '@tanstack/react-query';
import { useRoadmap } from '../useRoadmap';
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Clock, Lock, Map } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getCourse } from '@/features/courses/api';
import { cn } from '@/lib/utils';
import { CourseXpCard } from '@/features/gamification/CourseXpCard';
import { CourseQuizzes } from '@/features/assessment/components/CourseQuizzes';
import { ClassroomLink } from '@/features/classroom/ClassroomLink';
import { CourseSurveys } from '@/features/evidence/components/CourseSurveys';
import { LearningWeeksCard } from '@/features/gamification/LearningWeeksCard';
import { LeaderboardCard } from '@/features/gamification/LeaderboardCard';
import { QuestStageProgress } from '../components/QuestStageProgress';
import { questStageLabels } from '../resources';
import type { RoadmapLesson } from '../roadmap';

export default function StudentCoursePage() {
  const { courseId = '' } = useParams();
  const course = useQuery({
    queryKey: ['courses', 'detail', courseId],
    queryFn: () => getCourse(courseId),
  });
  const roadmap = useRoadmap(courseId);

  if (course.isPending || roadmap.isPending) return <PageSkeleton />;
  if (course.isError || roadmap.isError) {
    return <ErrorState onRetry={() => void Promise.all([course.refetch(), roadmap.refetch()])} />;
  }
  if (!course.data) return <EmptyState title="ไม่พบรายวิชา" description="คุณอาจยังไม่ได้เข้าร่วมรายวิชานี้" />;

  const r = roadmap.data;
  const visibleUnits = r.units.filter((u) => u.lessons.length > 0);

  return (
    <div className="space-y-6">
      <Link
        to="/student/courses"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        รายวิชาของฉัน
      </Link>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="space-y-4 lg:col-span-2">
          <div>
            <p className="text-sm text-muted-foreground">{course.data.code}</p>
            <h1 className="text-2xl font-bold tracking-tight">{course.data.name}</h1>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">ความคืบหน้า</span>
              <span className="text-muted-foreground tabular-nums">
                {r.completed}/{r.total} บทเรียน ({r.percent}%)
              </span>
            </div>
            <Progress
              value={r.completed}
              max={Math.max(1, r.total)}
              label="ความคืบหน้ารายวิชา"
              barClassName="xp-gradient"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {r.next && (
              <Link
                to={`/student/courses/${courseId}/lessons/${r.next.id}`}
                className={buttonVariants()}
              >
                {r.completed ? 'เรียนต่อ' : 'เริ่มเรียน'}: {r.next.title}
                <ArrowRight aria-hidden />
              </Link>
            )}
            <ClassroomLink courseId={courseId} />
          </div>
        </Card>
        <CourseXpCard courseId={courseId} />
        <LearningWeeksCard courseId={courseId} />
        <Card className="space-y-3 lg:col-span-2">
          <h2 className="font-semibold">เส้นทาง QUEST</h2>
          <QuestStageProgress stages={r.stages} />
        </Card>
        <CourseSurveys courseId={courseId} />
        <CourseQuizzes courseId={courseId} />
        <LeaderboardCard courseId={courseId} />
      </div>

      {visibleUnits.length === 0 ? (
        <EmptyState
          icon={Map}
          title="ยังไม่มีบทเรียนที่เปิดให้เรียน"
          description="ครูผู้สอนจะเผยแพร่บทเรียนเร็ว ๆ นี้"
        />
      ) : (
        <ol className="space-y-4" aria-label="หน่วยการเรียนรู้">
          {visibleUnits.map((unit) => (
            <li key={unit.id}>
              <Card className="space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-semibold">{unit.title}</h2>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {unit.completed}/{unit.lessons.length}
                  </span>
                </div>
                <ol className="space-y-2">
                  {unit.lessons.map((lesson) => (
                    <LessonRow key={lesson.id} lesson={lesson} courseId={courseId} />
                  ))}
                </ol>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const stateIcon = { completed: CheckCircle2, available: Circle, locked: Lock } as const;
const stateText = { completed: 'เรียนจบแล้ว', available: 'พร้อมเรียน', locked: 'ล็อกอยู่' } as const;

function LessonRow({ lesson, courseId }: { lesson: RoadmapLesson; courseId: string }) {
  const Icon = stateIcon[lesson.state];
  const body = (
    <>
      <Icon
        className={cn(
          'size-5 shrink-0',
          lesson.state === 'completed' && 'text-success',
          lesson.state === 'available' && 'text-primary',
          lesson.state === 'locked' && 'text-muted-foreground',
        )}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{lesson.title}</span>
        <span className="block text-xs text-muted-foreground">
          {stateText[lesson.state]}
          {lesson.lockedBy && ` — เรียน “${lesson.lockedBy}” ก่อน`}
          {lesson.quest_stage && ` · ${questStageLabels[lesson.quest_stage]}`}
        </span>
      </span>
      {lesson.estimated_minutes && (
        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3.5" aria-hidden />
          {lesson.estimated_minutes} นาที
        </span>
      )}
    </>
  );
  const className = 'flex min-h-14 items-center gap-3 rounded-lg border p-3';
  return (
    <li>
      {lesson.state === 'locked' ? (
        <div className={cn(className, 'bg-muted/40')} aria-disabled="true">
          {body}
        </div>
      ) : (
        <Link
          to={`/student/courses/${courseId}/lessons/${lesson.id}`}
          className={cn(className, 'hover:border-primary/50')}
        >
          {body}
        </Link>
      )}
    </li>
  );
}

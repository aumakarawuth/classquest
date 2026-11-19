import { BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Course } from './api';
import { courseLevelLabels, courseStatusLabels } from './schemas';

const statusTone = {
  draft: 'bg-muted text-muted-foreground',
  published: 'bg-success/15 text-foreground',
  archived: 'bg-muted text-muted-foreground line-through',
} as const;

export function CourseCard({
  course,
  to,
  showStatus,
}: {
  course: Course;
  to: string;
  showStatus?: boolean;
}) {
  return (
    <Link to={to} className="block rounded-lg">
      <Card className="h-full space-y-3 transition-colors hover:border-primary/50">
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BookOpen className="size-5" aria-hidden />
          </span>
          {showStatus && (
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-medium',
                statusTone[course.status],
              )}
            >
              {courseStatusLabels[course.status]}
            </span>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{course.code}</p>
          <h2 className="font-semibold">{course.name}</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          {courseLevelLabels[course.level]}
          {course.classroom && ` ${course.classroom}`} · ภาคเรียน {course.term}/{course.academicYear}
        </p>
      </Card>
    </Link>
  );
}

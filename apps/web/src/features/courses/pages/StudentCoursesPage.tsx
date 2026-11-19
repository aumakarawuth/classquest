import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, LogIn } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { fieldA11y, inputClass } from '@/components/ui/field-utils';
import { useAuth } from '@/features/auth/useAuth';
import { courseErrorMessage, joinCourse, listMyCourses } from '../api';
import { CourseCard } from '../CourseCard';
import { joinCodeSchema } from '../schemas';

type JoinInput = z.input<typeof joinCodeSchema>;
type JoinValues = z.output<typeof joinCodeSchema>;

export default function StudentCoursesPage() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const courses = useQuery({
    queryKey: ['courses', 'student', userId],
    queryFn: () => listMyCourses(userId ?? '', 'student'),
    enabled: !!userId,
  });

  const form = useForm<JoinInput, unknown, JoinValues>({
    resolver: zodResolver(joinCodeSchema),
    defaultValues: { code: '' },
  });
  const error = form.formState.errors.code?.message;
  const join = useMutation({
    mutationFn: (v: JoinValues) => joinCourse(v.code),
    onSuccess: () => {
      toast.success('เข้าร่วมรายวิชาแล้ว');
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
    onError: (e) => form.setError('code', { message: courseErrorMessage(e) }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">รายวิชาของฉัน</h1>
        <p className="text-sm text-muted-foreground">รายวิชาที่คุณเข้าร่วม</p>
      </div>

      <Card>
        <form noValidate onSubmit={form.handleSubmit((v) => join.mutate(v))} className="space-y-2">
          <label htmlFor="join-code" className="block font-semibold">
            เข้าร่วมรายวิชาด้วยรหัส
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              {...form.register('code')}
              {...fieldA11y('join-code', error, 'รับรหัสจากครูผู้สอนหรือใน Google Classroom')}
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="เช่น K7QX3MPA"
              className={`${inputClass} font-mono tracking-widest uppercase sm:max-w-xs`}
            />
            <Button type="submit" disabled={join.isPending}>
              <LogIn aria-hidden />
              {join.isPending ? 'กำลังเข้าร่วม…' : 'เข้าร่วม'}
            </Button>
          </div>
          {error ? (
            <p id="join-code-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : (
            <p id="join-code-hint" className="text-xs text-muted-foreground">
              รับรหัสจากครูผู้สอนหรือใน Google Classroom
            </p>
          )}
        </form>
      </Card>

      {courses.isPending ? (
        <PageSkeleton />
      ) : courses.isError ? (
        <ErrorState onRetry={() => void courses.refetch()} />
      ) : courses.data.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="ยังไม่ได้เข้าร่วมรายวิชา"
          description="กรอกรหัสจากครูด้านบนเพื่อเริ่มเรียน"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.data.map((course) => (
            <CourseCard key={course.id} course={course} to={`/student/courses/${course.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}

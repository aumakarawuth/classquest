import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/useAuth';
import { listMyCourses, type Course } from '@/features/courses/api';

export function useTeacherCourses() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ['courses', 'teacher', userId],
    queryFn: () => listMyCourses(userId ?? '', 'teacher'),
    enabled: !!userId,
  });
}

export const defaultCourse = (courses: Course[] | undefined) =>
  courses?.find((c) => c.status === 'published')?.id ?? courses?.[0]?.id ?? '';

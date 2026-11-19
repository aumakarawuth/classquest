import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/useAuth';
import { buildRoadmap } from './roadmap';
import { getRoadmapData } from './studentApi';

export function useRoadmap(courseId: string) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ['roadmap', courseId, userId],
    queryFn: async () => {
      const data = await getRoadmapData(courseId, userId ?? '');
      return buildRoadmap(data.units, data.completedIds);
    },
    enabled: !!userId,
  });
}

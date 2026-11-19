import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/useAuth';
import { listMySubmissions, listStudentQuests, type Submission } from './api';
import { questState, type QuestState } from './model';

/** All visible quests for the student with their latest submission and display state (2 requests). */
export function useStudentQuests() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ['quests', 'student', userId],
    enabled: !!userId,
    queryFn: async () => {
      const quests = await listStudentQuests();
      const submissions = await listMySubmissions(
        userId ?? '',
        quests.map((q) => q.id),
      );
      const byQuest = new Map<string, Submission[]>();
      for (const s of submissions) byQuest.set(s.quest_id, [...(byQuest.get(s.quest_id) ?? []), s]);
      const approved = new Set(
        submissions.filter((s) => s.status === 'approved').map((s) => s.quest_id),
      );
      const now = Date.now();
      return quests.map((q) => {
        const history = byQuest.get(q.id) ?? [];
        const latest = history[0];
        const state: QuestState = questState(
          {
            dueAt: q.due_at,
            allowLate: q.allow_late,
            maxAttempts: q.max_attempts,
            prerequisiteIds: q.quest_prerequisites.map((p) => p.required_quest_id),
            latest: latest ? { status: latest.status, attemptNo: latest.attempt_no } : null,
          },
          approved,
          now,
        );
        return { quest: q, history, state };
      });
    },
  });
}

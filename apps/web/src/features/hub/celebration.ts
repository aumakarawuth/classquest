/** Snapshot of rewards as reported by the database. Celebration only compares server values. */
export interface RewardSnapshot {
  xp: number;
  level: number;
  badgeIds: string[];
}
export interface RewardDiff {
  xpGained: number;
  levelUp: number | null;
  newBadges: number;
}

export function diffRewards(prev: RewardSnapshot | null, cur: RewardSnapshot): RewardDiff | null {
  if (!prev) return null; // first visit: remember silently, never celebrate past history
  const seen = new Set(prev.badgeIds);
  const diff: RewardDiff = {
    xpGained: Math.max(0, cur.xp - prev.xp),
    levelUp: cur.level > prev.level ? cur.level : null,
    newBadges: cur.badgeIds.filter((id) => !seen.has(id)).length,
  };
  return diff.xpGained || diff.levelUp || diff.newBadges ? diff : null;
}

const key = (userId: string, courseId: string) => `cq.rewards.${userId}.${courseId}`;

export function loadSnapshot(userId: string, courseId: string): RewardSnapshot | null {
  try {
    const raw = localStorage.getItem(key(userId, courseId));
    if (!raw) return null;
    const v = JSON.parse(raw) as RewardSnapshot;
    return typeof v.xp === 'number' && typeof v.level === 'number' && Array.isArray(v.badgeIds)
      ? v
      : null;
  } catch {
    return null;
  }
}

export function saveSnapshot(userId: string, courseId: string, s: RewardSnapshot) {
  try {
    localStorage.setItem(key(userId, courseId), JSON.stringify(s));
  } catch {
    /* storage unavailable: celebration is a convenience only */
  }
}

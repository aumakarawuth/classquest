import { diffRewards, loadSnapshot, saveSnapshot } from './celebration';

const s = (xp: number, level: number, badgeIds: string[] = []) => ({ xp, level, badgeIds });

it('does not celebrate on first visit or without change', () => {
  expect(diffRewards(null, s(100, 2))).toBeNull();
  expect(diffRewards(s(100, 2, ['a']), s(100, 2, ['a']))).toBeNull();
});

it('reports xp, level up and new badges', () => {
  expect(diffRewards(s(100, 1, ['a']), s(250, 2, ['a', 'b']))).toEqual({
    xpGained: 150,
    levelUp: 2,
    newBadges: 1,
  });
  expect(diffRewards(s(300, 3), s(200, 3))).toBeNull();
});

it('round-trips snapshots and tolerates bad data', () => {
  saveSnapshot('u', 'c', s(10, 1, ['x']));
  expect(loadSnapshot('u', 'c')).toEqual(s(10, 1, ['x']));
  localStorage.setItem('cq.rewards.u.c', '{bad');
  expect(loadSnapshot('u', 'c')).toBeNull();
});

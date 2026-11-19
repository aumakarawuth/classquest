import { describeRule } from './badges';

it('describes badge rules in Thai', () => {
  expect(describeRule(null)).toBe('ครูเป็นผู้มอบ');
  expect(describeRule({ type: 'quests_approved', count: 5 })).toBe('ผ่าน 5 ภารกิจ');
  expect(describeRule({ type: 'boss_approved' })).toBe('ผ่าน Boss Quest');
  expect(describeRule({ type: 'level_reached', count: 5 })).toBe('ถึงเลเวล 5');
});

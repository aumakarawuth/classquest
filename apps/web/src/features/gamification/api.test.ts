import { validateLadder } from './api';

it('validates level ladders like the server', () => {
  expect(validateLadder([])).toBeNull();
  expect(validateLadder([{ xp_threshold: 0 }, { xp_threshold: 100 }])).toBeNull();
  expect(validateLadder([{ xp_threshold: 10 }])).toBe('เลเวล 1 ต้องเริ่มที่ 0 XP');
  expect(validateLadder([{ xp_threshold: 0 }, { xp_threshold: 0 }])).toBe(
    'XP ของเลเวล 2 ต้องมากกว่าเลเวล 1',
  );
});

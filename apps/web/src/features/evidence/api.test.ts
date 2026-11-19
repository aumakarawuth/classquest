import { evidenceCategories, likertLevel } from './api';

it('has the 13 categories from the competition brief', () => {
  expect(evidenceCategories).toHaveLength(13);
});

it('interprets Likert means', () => {
  expect(likertLevel(4.6)).toBe('มากที่สุด');
  expect(likertLevel(3.51)).toBe('มาก');
  expect(likertLevel(3)).toBe('ปานกลาง');
  expect(likertLevel(null)).toBe('–');
});

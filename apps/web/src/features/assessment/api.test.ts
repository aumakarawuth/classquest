import { validateQuestion, type QuestionInput } from './api';

const base: QuestionInput = {
  type: 'mc',
  stem: 'ข้อใด',
  explanation: '',
  points: 1,
  competency_id: null,
  bank_tag: '',
  options: [],
};

it('validates questions like the server', () => {
  expect(
    validateQuestion({
      ...base,
      options: [
        { label: 'a', is_correct: true },
        { label: 'b', is_correct: false },
      ],
    }),
  ).toBeNull();
  expect(validateQuestion({ ...base, options: [{ label: 'a', is_correct: true }] })).toBe(
    'ปรนัยต้องมี 2–8 ตัวเลือก',
  );
  expect(
    validateQuestion({
      ...base,
      options: [
        { label: 'a', is_correct: false },
        { label: 'b', is_correct: false },
      ],
    }),
  ).toBe('เลือกคำตอบที่ถูกต้อง 1 ข้อ');
  expect(validateQuestion({ ...base, stem: ' ' })).toBe('กรุณากรอกคำถาม');
  expect(validateQuestion({ ...base, type: 'short', options: [] })).toBeNull();
});

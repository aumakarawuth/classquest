import type { Question, QuestionInput } from './api';

export function emptyQuestion(): QuestionInput {
  return {
    type: 'mc',
    stem: '',
    explanation: '',
    points: 1,
    competency_id: null,
    bank_tag: '',
    options: [
      { label: '', is_correct: true },
      { label: '', is_correct: false },
    ],
  };
}

export function toInput(q: Question): QuestionInput {
  return {
    type: q.type,
    stem: q.stem,
    explanation: q.explanation,
    points: q.points,
    competency_id: q.competency_id,
    bank_tag: q.bank_tag,
    options: q.question_options.map((o) => ({ label: o.label, is_correct: o.is_correct })),
  };
}

export function questionErrorMessage(e: unknown) {
  const message = (e as { message?: string; code?: string } | null)?.message ?? '';
  if (message.includes('CQ_INVALID_QUESTION')) return 'คำถามไม่ถูกต้อง กรุณาตรวจตัวเลือกและคำตอบ';
  if ((e as { code?: string }).code === '23503') return 'ลบไม่ได้: คำถามนี้ถูกใช้ในแบบทดสอบ';
  return 'บันทึกไม่สำเร็จ';
}

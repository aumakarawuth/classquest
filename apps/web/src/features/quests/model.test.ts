import {
  bangkokLocalToIso,
  isoToBangkokLocal,
  questFormSchema,
  questState,
  validateSubmissionFile,
} from './model';

const base = { dueAt: null, allowLate: true, maxAttempts: 2, prerequisiteIds: [], latest: null };
const now = Date.parse('2026-11-19T12:00:00Z');

describe('questState', () => {
  it('handles the basic lifecycle', () => {
    expect(questState(base, new Set(), now)).toBe('available');
    expect(
      questState({ ...base, latest: { status: 'submitted', attemptNo: 1 } }, new Set(), now),
    ).toBe('submitted');
    expect(
      questState({ ...base, latest: { status: 'needs_revision', attemptNo: 1 } }, new Set(), now),
    ).toBe('needs_revision');
    expect(
      questState({ ...base, latest: { status: 'needs_revision', attemptNo: 2 } }, new Set(), now),
    ).toBe('closed');
    expect(
      questState({ ...base, latest: { status: 'approved', attemptNo: 1 } }, new Set(), now),
    ).toBe('approved');
  });
  it('locks until prerequisites are approved', () => {
    expect(questState({ ...base, prerequisiteIds: ['q0'] }, new Set(), now)).toBe('locked');
    expect(questState({ ...base, prerequisiteIds: ['q0'] }, new Set(['q0']), now)).toBe(
      'available',
    );
  });
  it('closes past-due quests only when late work is not allowed', () => {
    const past = '2026-11-18T00:00:00Z';
    expect(questState({ ...base, dueAt: past, allowLate: false }, new Set(), now)).toBe('closed');
    expect(questState({ ...base, dueAt: past, allowLate: true }, new Set(), now)).toBe('available');
  });
});

it('validates files before upload', () => {
  expect(validateSubmissionFile({ size: 100, type: 'application/pdf' })).toBeNull();
  expect(validateSubmissionFile({ size: 3 * 1024 * 1024, type: 'image/png' })).toContain('2 MB');
  expect(validateSubmissionFile({ size: 10, type: 'application/zip' })).toContain('PNG');
});

it('requires a Classroom link when classroom submission is chosen', () => {
  const result = questFormSchema.safeParse({
    title: 'Mission',
    type: 'main',
    unitId: '',
    questStage: '',
    descriptionMd: '',
    objectives: '',
    difficulty: 1,
    maxScore: 10,
    xpReward: 100,
    dueAt: '',
    allowLate: true,
    submitModes: ['classroom'],
    classroomUrl: 'https://example.com',
    maxAttempts: 1,
    prerequisiteIds: [],
    published: false,
  });
  expect(result.error?.issues[0]?.path).toEqual(['classroomUrl']);
});

it('converts Bangkok local time to ISO and back', () => {
  expect(bangkokLocalToIso('2026-11-20T23:59')).toBe('2026-11-20T16:59:00.000Z');
  expect(isoToBangkokLocal('2026-11-20T16:59:00.000Z')).toBe('2026-11-20T23:59');
  expect(bangkokLocalToIso('')).toBeNull();
});

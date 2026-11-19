import { courseFormSchema, currentAcademicTerm, joinCodeSchema } from './schemas';

it('computes Thai academic year and term in Bangkok time', () => {
  expect(currentAcademicTerm(new Date('2026-06-15T00:00:00Z'))).toEqual({
    academicYear: 2569,
    term: 1,
  });
  expect(currentAcademicTerm(new Date('2026-11-19T00:00:00Z'))).toEqual({
    academicYear: 2569,
    term: 2,
  });
  expect(currentAcademicTerm(new Date('2027-02-01T00:00:00Z'))).toEqual({
    academicYear: 2569,
    term: 2,
  });
  // 30 Apr 18:00 UTC is already 1 May in Bangkok → term 1
  expect(currentAcademicTerm(new Date('2026-04-30T18:00:00Z'))).toEqual({
    academicYear: 2569,
    term: 1,
  });
});

it('validates the course form with Thai messages', () => {
  const result = courseFormSchema.safeParse({
    code: '',
    name: 'IoT',
    level: 'pvs',
    classroom: '',
    term: '1',
    academicYear: '2026',
    weeks: '18',
    description: '',
  });
  expect(result.success).toBe(false);
  const messages = result.error?.issues.map((i) => i.message) ?? [];
  expect(messages).toContain('กรุณากรอกรหัสวิชา');
  expect(messages).toContain('ใช้ปี พ.ศ.');
});

it('normalises join codes', () => {
  expect(joinCodeSchema.parse({ code: ' abcd2345 ' }).code).toBe('ABCD2345');
  expect(joinCodeSchema.safeParse({ code: 'ab-1' }).success).toBe(false);
});

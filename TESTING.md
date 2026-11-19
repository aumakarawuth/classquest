# TESTING
| ระดับ | เครื่องมือ | ขอบเขต |
|---|---|---|
| Unit | Vitest | utils (level calc display, date TZ Bangkok), Zod schemas |
| Component | Vitest + Testing Library | forms, states, a11y (vitest-axe) |
| DB/RLS | pgTAP (`supabase test db`) | ทุก policy: student/teacher/other-course/anon |
| Integration | Vitest + local Supabase | RPC: submit/review/quiz/XP idempotency, concurrency (Promise.all 30) |
| E2E | Playwright (`--trace off`) | login (test helper), join course, lesson, quest submit, review, quiz; viewport mobile/tablet/desktop; @axe-core/playwright |
| Load | k6 `tests/load/classroom.js` (staging เท่านั้น) | 30 VU พร้อมกัน: sign-in → roadmap/XP → จบบทเรียน → ส่งภารกิจ → ทำแบบทดสอบ; เกณฑ์ p95 < 800 ms, error < 1% |
| CSP | Playwright `e2e/csp.spec.ts` | ใช้ CSP จริงจาก `_headers` กับ build แล้วต้องไม่มีการบล็อก |

## วิธีรัน DB tests
- Local ไม่ใช้ Docker: `supabase/tests/local/run.sh` (ต้องมี postgresql-16 + postgresql-16-pgtap)
- Supabase CLI: `supabase test db`
- ไฟล์ทดสอบ: `supabase/tests/database/*.test.sql` (helper `tests.act_as(uuid)` จำลองผู้ใช้)

## Must-pass security tests
1. student INSERT xp_transactions → denied  2. student UPDATE user_roles → denied  3. student SELECT quiz_attempts ของคนอื่น → 0 rows  4. student SELECT question_options.is_correct → error  5. review ซ้ำด้วย key เดิม → XP 1 แถว  6. non-member SELECT lessons ของวิชาอื่น → 0 rows

## Load test results
_ยังไม่ได้ทดสอบ — ห้ามกล่าวอ้างว่ารองรับ 30 คนพร้อมกันจนกว่าจะบันทึกผลที่นี่_ (target p95 < 800ms, error < 1%)

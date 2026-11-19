# API (Supabase RPC & Edge Functions)

ทุก RPC: `SECURITY DEFINER`, `set search_path = ''`, ตรวจสิทธิ์ภายใน, คืนค่า JSON, error code แบบ `CQ_xxx`

| RPC | Caller | Input | Effect |
|---|---|---|---|
| `approve_user(user_id, role)` | admin | | status=active + role + audit |
| `set_user_role(user_id, role, grant bool)` | admin | | audit |
| `join_course_by_code(code)` | student | text | insert course_members, uses++ |
| `clone_course(course_id, term, year)` | teacher | | คัดลอก units/lessons/quests/quizzes/competencies (ไม่คัดลอกข้อมูลนักเรียน) |
| `complete_lesson(lesson_id)` | student | | ตรวจ unlock rule, progress, XP (idempotent) |
| `submit_quest(quest_id, text, url, storage_path)` | student | | ตรวจ prerequisite, due, resubmission limit |
| `review_submission(submission_id, decision, score, rubric, feedback, idempotency_key)` | teacher | | review + rubric + competency + XP + badge |
| `start_quiz_attempt(quiz_id)` | student | | สุ่มคำถาม, คืนคำถามไม่มีเฉลย |
| `submit_quiz_attempt(attempt_id, answers)` | student | jsonb | auto-grade, XP |
| `grade_short_answer(answer_id, points, feedback)` | teacher | | |
| `adjust_xp(user_id, course_id, amount, reason)` | teacher | | manual ledger entry + audit |
| `get_leaderboard(course_id)` | member | | nickname, level, xp (ถ้าเปิด, opt-in) |
| `get_teacher_dashboard(course_id, filters)` | teacher | | aggregated metrics |
| `export_course_data(course_id, anonymized)` | teacher/admin | | JSON/CSV payload |

Edge Functions: `ai-tutor` (POST {lessonId, message}) · `classroom-import` (Phase B) · `backup-export` (admin)
Zod schemas อยู่ใน `features/*/schemas.ts` และใช้ทั้งฝั่ง form และ validate response

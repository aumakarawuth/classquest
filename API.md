# API (Supabase RPC & Edge Functions)

ทุก RPC: `SECURITY DEFINER`, `set search_path = ''`, ตรวจสิทธิ์ภายใน, คืนค่า JSON, error code แบบ `CQ_xxx`

| RPC | Caller | Input | Effect |
|---|---|---|---|
| `admin_set_user_status(_user_id, _status)` | admin | | pending/active/suspended, idempotent, ห้ามระงับตัวเอง, audit |
| `admin_set_user_role(_user_id, _role, _grant)` | admin | | idempotent, ห้ามถอน admin ของตัวเอง, audit เฉพาะเมื่อเปลี่ยนจริง |
| `private.bootstrap_admin(email)` | SQL editor เท่านั้น | | ตั้ง admin คนแรก (ใช้ได้เมื่อยังไม่มี admin) |
| `create_enrollment_code(_course_id, _expires_at, _max_uses)` | course teacher | | สร้างรหัส 8 ตัวแบบสุ่มฝั่ง server (ไม่มี 0/O/1/I) |
| `join_course_by_code(_code)` | student | text | ตรวจ active/หมดอายุ/จำนวนครั้ง/archived; เข้าซ้ำ idempotent ไม่นับครั้ง |
| `clone_course(_source_id, _term, _academic_year, _classroom)` | course teacher | | คัดลอก units/lessons/resources + remap prerequisite เป็น draft (ไม่คัดลอกนักเรียน); quests/quizzes/competencies จะเพิ่มเมื่อมีตาราง |
| `complete_lesson(lesson_id)` | student | | ตรวจ unlock rule, progress, XP (idempotent) |
| `submit_quest(_quest_id, _text, _url, _storage_path)` | student | | ตรวจ published/สมาชิก, วิธีส่งที่อนุญาต, https, ไฟล์ต้องเป็นของตนใน `{course}/{user}/`, prerequisite approved, ห้ามส่งระหว่างรอตรวจ, `max_attempts`, กำหนดส่ง (`allow_late` → `is_late`) |
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

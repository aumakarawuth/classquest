# SECURITY & PRIVACY

## Threat model (นักเรียนเป็นผู้ใช้ที่ไม่น่าเชื่อถือ)
| ภัย | มาตรการ |
|---|---|
| แก้ XP/คะแนนตนเอง | ไม่มี INSERT/UPDATE policy บน `xp_transactions`, `quiz_attempts.score`, `quest_reviews`, `competency_results`, `rubric_results` สำหรับ student; เขียนผ่าน RPC เท่านั้น |
| เปลี่ยน role | `user_roles` ไม่มี write policy; `set_user_role` ตรวจ `is_admin()`; role ไม่อ่านจาก `user_metadata` (client แก้ได้) |
| ดูคะแนนคนอื่น | RLS `user_id = auth.uid()` หรือ `is_course_teacher(course_id)` |
| ดูวิชาที่ไม่ได้ลงทะเบียน | helper `is_course_member(course_id)` ทุก policy |
| เห็นเฉลยก่อนเวลา | `question_options.is_correct` revoke column; client ใช้ view `question_options_public`; explanation ส่งหลัง `answers_visible_at` ผ่าน RPC |
| XSS | Markdown render ด้วย sanitizer (rehype-sanitize), ไม่ใช้ `dangerouslySetInnerHTML`, CSP header ใน `_headers`, iframe allowlist (youtube, wokwi, docs.google) |
| SQL injection | PostgREST parameterized; RPC ไม่ใช้ dynamic SQL; `search_path=''` |
| Upload อันตราย | bucket private, MIME allowlist (png/jpg/webp/pdf), ≤ 2 MB, path `{course}/{user}/…`, signed URL อายุสั้น |
| Abuse/Rate | AI: per-user/day + global/day ใน `ai_usage`; RPC submit ตรวจความถี่; Supabase Auth rate limits |
| Token leak | Service role key/Gemini key/Google client secret เฉพาะ Edge Function secrets; OAuth refresh token ใน schema `private` เข้ารหัสด้วย pgsodium/Vault |

## Privacy (PDPA)
- เก็บเท่าที่จำเป็น: ชื่อที่แสดง, email (จาก Google), รหัสนักเรียน (optional)
- Leaderboard แสดง nickname, ปิดได้; Portfolio private by default
- รายงานเผยแพร่ใช้ `anonymous_codes`
- AI: PII scrubber ลบชื่อ/รหัส/email/เบอร์ก่อนส่ง; ไม่ส่งคะแนน
- มีหน้าประกาศความเป็นส่วนตัว (ภาษาไทย) + การขอลบ/ส่งออกข้อมูลตนเอง
- Audit log ทุกการเปลี่ยน role, คะแนน, XP manual, export

## Checklist ก่อน Production
- [ ] RLS enabled ทุกตาราง (`supabase db lint` + advisors)
- [ ] pgTAP RLS tests ผ่าน
- [ ] ไม่มี secret ใน repo (gitleaks ใน CI)
- [ ] Google OAuth redirect เฉพาะ pages.dev + localhost

# PROJECT_SPEC — ClassQuest

> สถานะ: **Phase 0 – Planning (รออนุมัติ Architecture และ MVP Scope)**
> Timezone: Asia/Bangkok · ภาษาหลัก: ไทย · Code/Naming: English

## 1. วิสัยทัศน์
ClassQuest คือแพลตฟอร์ม Gamified Learning & Competency สำหรับ ปวช./ปวส. ที่ **ทำงานคู่กับ Google Classroom** (ไม่ทดแทน) ใช้รูปแบบการเรียนรู้ **QUEST** (Question → Understand → Experiment → Solve → Transfer) รายวิชานำร่อง: 31910-2012 อินเทอร์เน็ตเพื่อสรรพสิ่ง

## 2. การวิเคราะห์ Requirements (สรุป)
| กลุ่ม | ประเด็นสำคัญ | ผลต่อการออกแบบ |
|---|---|---|
| ค่าใช้จ่าย 0 บาท | Free tier เท่านั้น, ไม่มี auto billing | Supabase Free (ไม่ผูกบัตร), Cloudflare Pages Free, AI optional |
| ความปลอดภัย | นักเรียนแก้ XP/คะแนน/role ไม่ได้, เฉลยไม่หลุด | RLS ทุกตาราง + RPC `SECURITY DEFINER` สำหรับธุรกรรมสำคัญ |
| ความยืดหยุ่น | เพิ่มรายวิชาโดยไม่แก้โค้ด | ทุกอย่างเป็นข้อมูล (course, unit, quest, competency, level) |
| การประกวด | หลักฐานจริง, Pre/Post-test, anonymized | Evidence Center + anonymous code ต่อผู้เรียน |
| ความเสถียร | ใช้ได้แม้ Classroom API/AI ล่ม | Fallback: link, CSV, manual |

## 3. ข้อขัดแย้งที่พบ และข้อเสนอ
| # | ข้อขัดแย้ง | ข้อเสนอ |
|---|---|---|
| C1 | Supabase Free **pause โปรเจกต์เมื่อไม่มีกิจกรรม ~7 วัน** (ช่วงปิดภาคเรียน) | GitHub Actions cron ping สัปดาห์ละ 2 ครั้ง + คู่มือ restore; บันทึกใน ADR-0002 |
| C2 | Free tier **ไม่มี automatic backup ที่ดาวน์โหลดได้** | GitHub Actions `pg_dump` รายสัปดาห์ → เข้ารหัส → เก็บใน private artifact/Drive ของครู + ปุ่ม Export CSV/JSON |
| C3 | Google Classroom API scope บางตัวเป็น sensitive/restricted ต้อง verify app | Phase A (link + CSV) เป็น MVP; Phase B ใช้ OAuth แบบ "Testing" (≤100 test users) ภายใน Workspace สถานศึกษา |
| C4 | Supabase Storage free 1 GB | รับเฉพาะไฟล์ ≤ 2 MB (รูป/PDF), งานใหญ่ให้ส่ง Google Drive link |
| C5 | Gemini Free tier: ข้อมูลอาจถูกใช้ปรับปรุงโมเดล และโควตาเปลี่ยนบ่อย | ปิดโดยค่าเริ่มต้น, ส่งเฉพาะข้อความที่ผ่าน PII scrubber, fallback Hint Library |
| C6 | Embed Wokwi อาจถูกจำกัดโดยผู้ให้บริการ | ใช้ลิงก์เปิดแท็บใหม่เป็นค่าเริ่มต้น embed เป็น opt-in เมื่อทดสอบแล้ว |
| C7 | "Leaderboard" vs PDPA/ความเท่าเทียม | ปิดโดยค่าเริ่มต้น, แสดงเฉพาะ nickname + XP, ผู้เรียน opt-out ได้ |
| C8 | Streak "ไม่ลงโทษ" | ใช้ weekly streak + freeze อัตโนมัติ, ไม่หัก XP |

## 4. MVP Scope (สำหรับนำร่องภาคเรียนแรก)
**MVP (ต้องมี)**
1. Google Sign-in + Account approval + Role (admin/teacher/student) กำหนดโดย admin เท่านั้น
2. Course CRUD, enrollment code, clone course, สถานะ Draft/Published/Archived
3. Learning Units (18 สัปดาห์) + Lessons (Text/Image/YouTube/Drive/Slides/PDF link/Code/External/Wokwi) + progress + prerequisite
4. Quest System (6 ประเภท) + submission (text/URL/ไฟล์เล็ก) + review + rubric + resubmission limit
5. Gamification: XP ledger (idempotent), Levels แก้ไขได้, Badges (manual + rule พื้นฐาน), Progress bar, Skill Tree (จาก competency), Leaderboard toggle
6. Assessment: Pre/Post-test, Quiz MC/TF/Short answer, question bank, random, auto-grade ฝั่ง server, manual grade, attempt history
7. Competency: framework, mapping, competency results, skill matrix
8. Classroom Phase A: link course/assignment/material, CSV import/export roster & grades
9. Virtual Lab: Wokwi URL + instructions + code + expected result + evidence submission
10. Teacher Dashboard พื้นฐาน + Students Requiring Support
11. Portfolio (private, print view) + Student reflection
12. Evidence Center + export CSV + print report + anonymized codes
13. Admin: users/roles, audit log, export/backup, quota page (manual/estimated)

**Future (หลัง MVP)**: Classroom API Phase B, AI Tutor, Surveys builder ขั้นสูง, Achievement rule engine ขั้นสูง, Daily quest auto-generation, PWA offline, Notifications ทาง email/LINE

## 5. Non-Functional Targets
- 30 นักเรียนพร้อมกัน: p95 API < 800 ms, error rate < 1% (ต้องพิสูจน์ด้วย load test ก่อนกล่าวอ้าง)
- Lighthouse mobile ≥ 85, initial JS < 250 KB gzip
- WCAG 2.1 AA

## 6. ข้อห้าม (สรุปจาก brief)
ไม่ใช้ข้อมูลคะแนนจาก frontend · ไม่ hardcode secrets/roles · ไม่มี mock data ใน production · ไม่สร้างข้อมูลผลสัมฤทธิ์ปลอม · ปุ่มที่ยังไม่เสร็จต้องแสดงสถานะ "Coming soon"

## 7. Learning Model: QUEST
ทุก Learning Unit มี 5 stage (`quest_stage` enum: question, understand, experiment, solve, transfer); บทเรียน/ภารกิจ/แบบทดสอบผูก stage และ competency ได้ — QUEST เป็นรูปแบบที่เสนอ ต้องผ่านการตรวจสอบโดยผู้เชี่ยวชาญและทดลองใช้จริง

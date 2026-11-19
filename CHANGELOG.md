# Changelog
รูปแบบ: Keep a Changelog · Conventional Commits

## [Unreleased]
### Added
- P2-06: ครู — รายการภารกิจของรายวิชา, ตัวแก้ไขภารกิจ (ประเภท, หน่วย, ขั้น QUEST, Markdown, จุดประสงค์, ความยาก, คะแนน, XP, กำหนดส่งเวลาไทย, รับงานช้า, วิธีส่ง, ลิงก์ Classroom, จำนวนครั้ง, ภารกิจก่อนหน้า, เผยแพร่, ลบ); นักเรียน — กระดานภารกิจ (ต้องทำ/รอตรวจ/ผ่านแล้ว/ทั้งหมด), รายละเอียดภารกิจ + ส่งงาน (ข้อความ/ลิงก์/ไฟล์ ≤ 2 MB ตรวจก่อนอัปโหลด/ลิงก์ไป Classroom) + ประวัติการส่ง (เปิดไฟล์ด้วย signed URL 5 นาที)
- P2-05: ตาราง quests (6 ประเภท, ความยาก, คะแนน, XP reward, กำหนดส่ง, วิธีส่ง, จำนวนครั้ง), quest_prerequisites, quest_submissions; RPC `submit_quest` (ตรวจสิทธิ์, วิธีส่ง, https, ไฟล์ของตนเอง, prerequisite, ห้ามส่งซ้ำระหว่างรอตรวจ, จำนวนครั้ง, กำหนดส่ง/ส่งช้า, กัน race); bucket `submissions` (private, 2 MB, PNG/JPEG/WebP/PDF) + storage policies
- P2-04: RPC `complete_lesson` (บังคับ prerequisite ฝั่ง server, idempotent), หน้าเส้นทางการเรียนของรายวิชา (ความคืบหน้า, QUEST stepper, สถานะเรียนจบ/พร้อมเรียน/ล็อก, เรียนต่อ), หน้าเรียนบทเรียน (เนื้อหา + สื่อ, ทำเครื่องหมายเรียนจบ, ก่อนหน้า/ถัดไป)
### Changed
- นำเมนู "เส้นทางการเรียน" ที่ซ้ำออก (เส้นทางอยู่ในหน้ารายวิชา); Markdown heading เริ่มที่ h2
- P2-03: Course Builder (แก้ชื่อ/เผยแพร่หน่วย, เพิ่ม/ลบ/เรียงลำดับ/เผยแพร่บทเรียน), Lesson Editor (Markdown + ดูตัวอย่าง, ขั้น QUEST, บทเรียนก่อนหน้า, เวลา), สื่อ 11 ประเภท (https + จำกัดโดเมนตามประเภท, YouTube แบบ nocookie), RPC `reorder_lessons`/`reorder_resources`, Markdown renderer ที่ไม่ render HTML
- P2-01/P2-02: learning_units/lessons/lesson_resources/lesson_progress + RLS (นักเรียนเห็นเฉพาะเนื้อหาที่เผยแพร่), สร้าง 18 หน่วยอัตโนมัติ, RPC `create_enrollment_code`/`join_course_by_code`/`clone_course`; หน้า จัดการรายวิชา/สร้างรายวิชา/รายละเอียดรายวิชา (สถานะ, รหัสเข้าร่วม, คัดลอก) และ รายวิชาของฉัน (เข้าร่วมด้วยรหัส)
- P1-08: RPC `admin_set_user_status`/`admin_set_user_role` (audited, idempotent, กัน self-lockout), `private.bootstrap_admin`, หน้า Admin › ผู้ใช้งาน (อนุมัติ/สิทธิ์/ระงับ, ค้นหา, แบ่งหน้า), สิทธิ์การใช้งาน, Audit Log; pgTAP +14
- P1-06: Google sign-in (Supabase PKCE), AuthProvider + TanStack Query, หน้า Login/Callback/รออนุมัติ/ไม่มีสิทธิ์, RequireArea guard ตาม role จาก DB, ออกจากระบบพร้อมยืนยัน
### Removed
- หน้าแรกแบบ "ตัวอย่างโครงหน้า" (ถูกแทนด้วย login)
- P1-07: pgTAP RLS/permission tests (31 assertions) in `supabase/tests/database`, CI `database` job
- P1-05: migration core (profiles, user_roles, system_settings + feature flags, courses, course_members, enrollment_codes, audit_logs), RLS baseline, domain restriction trigger, local Postgres test harness
- P1-04: AppShell (sidebar desktop / bottom nav mobile, skip link) สำหรับ student/teacher/admin, lazy routes, EmptyState/ErrorState/PageSkeleton/ConfirmDialog/Toaster/ComingSoon, route error boundary
- P1-03: design tokens (Tailwind v4), light/dark/system theme, Inter + Noto Sans Thai, shadcn/ui config, Button/Card/Progress/ThemeToggle/XpBar, axe WCAG AA tests
- P1-01: scaffold `apps/web` (Vite 8, React 19, TypeScript 6 strict, ESLint 10, Prettier, Vitest 5, Playwright) + CI workflow
- P0-05: ADR-0006 Google Workspace for Education + Internal OAuth + domain restriction
- P0-01: เอกสาร Phase 0 (spec, architecture, database, security, free-tier budget, design system, roadmap, tasks, ADR 0001–0005)

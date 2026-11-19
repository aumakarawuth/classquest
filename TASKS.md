# TASKS — Single Source of Truth

สถานะ: `todo` · `in-progress (owner)` · `review` · `done` · Owner: `claude` / `codex` / `human`
กฎ: 1 task = 1 branch `<type>/<task-id>-slug` · ระบุไฟล์ที่จะแตะก่อนเริ่ม · ห้ามสอง AI ทำไฟล์เดียวกันพร้อมกัน

## Phase 0
| ID | Task | Owner | Status | Acceptance Criteria |
|---|---|---|---|---|
| P0-01 | Requirements, architecture, docs ชุดแรก | claude | review | เอกสารครบตาม §15, รอผู้อนุมัติ |
| P0-02 | อนุมัติ Architecture & MVP scope (อนุมัติแล้ว, repo Public) | human | done | ผู้รับผิดชอบโครงการลงความเห็นใน PR/Issue |
| P0-03 | ยืนยัน free tier limits จากหน้าทางการ + บันทึกวันที่ | human/codex | todo | ตารางใน FREE_TIER_BUDGET.md มีลิงก์+วันที่ตรวจ |
| P0-05 | ยืนยันการใช้ Google Workspace for Education → ADR-0006 | claude | review | ADR + DEPLOYMENT/TASKS อัปเดต |
| P0-04 | ตรวจเกณฑ์การประกวดทั้ง 2 ประเภท map กับ Evidence Center | human/claude | todo | ตาราง mapping เกณฑ์ ↔ ฟีเจอร์ |

## Phase 1 Foundation
| ID | Task | Owner | Status | Acceptance Criteria |
|---|---|---|---|---|
| P1-01 | Scaffold Vite+React+TS strict, ESLint, Prettier, Vitest, Playwright (+ CI พื้นฐาน) | claude | review | `npm run lint typecheck test build` ผ่านใน CI |
| P1-02 | ขยาย CI: gitleaks, cache Playwright, supabase test db | codex | todo | PR แสดง check เขียว |
| P1-03 | Design tokens + Tailwind + shadcn + light/dark + fonts | claude | todo | toggle theme, contrast AA ตรวจด้วย axe |
| P1-04 | App shell: layouts 3 role, sidebar/bottom nav, states components | claude | todo | responsive 360/768/1280px, keyboard nav |
| P1-05 | Supabase project + config + migration `0001_core` (profiles, roles, courses, members, settings) | codex | todo | `supabase db reset` ผ่าน |
| P1-06 | Google sign-in (Workspace Internal, ADR-0006) + domain restriction + pending approval + role guard routes | codex | todo | อีเมลนอกโดเมนถูกปฏิเสธฝั่ง DB; ผู้ใช้ใหม่ status=pending เข้า dashboard ไม่ได้จนอนุมัติ |
| P1-07 | RLS helpers + policies + pgTAP tests | codex | todo | student เปลี่ยน role/อ่านวิชาอื่น ไม่ได้ (test) |
| P1-08 | Admin: approve users, roles, audit log list | claude(UI)+codex(RPC) | todo | ทุกการเปลี่ยน role มี audit row |

## Phase 2 Core Learning
| ID | Task | Owner | AC |
|---|---|---|---|
| P2-01 | Migration learning (units, lessons, resources, progress) | codex | default 18 units เมื่อสร้างวิชา |
| P2-02 | Course management + clone + enrollment code | codex/claude | clone ไม่คัดลอกข้อมูลนักเรียน; code หมดอายุใช้ไม่ได้ |
| P2-03 | Course Builder + Lesson Editor (markdown + resources) | claude | เพิ่ม resource ครบ 11 ประเภท, preview ปลอดภัย (sanitize) |
| P2-04 | Student Roadmap (QUEST stepper) + Lesson Viewer + unlock | claude | บทเรียนที่ยังล็อกแสดงเงื่อนไข |
| P2-05 | Quest migration + `submit_quest` RPC + storage bucket | codex | ไฟล์ > 2MB/MIME อื่นถูกปฏิเสธ; เกิน resubmission ถูกปฏิเสธ |
| P2-06 | Quest Board/Detail/Editor UI | claude | 6 ประเภทแสดงต่างกัน, empty/loading/error states |
| P2-07 | `review_submission` RPC + Review UI + rubric | codex/claude | approve ซ้ำไม่ได้ XP ซ้ำ |
| P2-08 | Seed dev: IoT course + 10 missions + 30 fake students | codex | seed ใช้เฉพาะ local/dev |

## Phase 3–8 (สรุป, แตกย่อยเมื่อเริ่ม phase)
| ID | Task | AC หลัก |
|---|---|---|
| P3-01 | XP ledger + levels editable + level calc view | XP = SUM(ledger), unique constraint ทดสอบ race 30 concurrent |
| P3-02 | Badges + rules + Achievements page | award idempotent |
| P3-03 | Skill tree (competency parent) + streak weekly | ไม่หัก XP เมื่อขาด |
| P3-04 | Leaderboard toggle + opt-out | ไม่มี email/คะแนนสอบใน response |
| P4-01 | Quiz builder + question bank + random | |
| P4-02 | Attempt RPC + auto-grade + manual short answer | `is_correct` ไม่ปรากฏใน network ของ student (Playwright) |
| P4-03 | Pre/Post-test comparison report | คำนวณ gain จากข้อมูลจริง |
| P4-04 | Competency framework, mapping, matrix, individual report | ครูเห็นผ่าน/ไม่ผ่านรายสมรรถนะ |
| P5-01 | Classroom links + CSV import roster / export grades | ใช้ได้โดยไม่มี Google API |
| P5-02 | Virtual Lab (Wokwi link/embed flag) | embed ปิดแล้วยังใช้ลิงก์ได้ |
| P6-01 | Teacher dashboard + filters + students requiring support | query ≤ 3 requests ต่อหน้า |
| P6-02 | Portfolio + reflection + print view | private by default |
| P6-03 | Evidence center + anonymized export + print report | ไม่มีชื่อจริงใน anonymized export |
| P6-04 | Admin backup/export + quota page | restore drill สำเร็จ |
| P7-01 | AI Tutor edge function + limits + PII scrub + fallback | flag off → เมนูซ่อน/แสดง hint library |
| P7-02 | Classroom API Phase B (read-only scopes) | ไม่มีการเขียนกลับโดยไม่มี confirm dialog |
| P8-01 | k6 load test 30 VUs | บันทึก p95, error rate |
| P8-02 | Security review + RLS audit | ไม่มี advisor error |
| P8-03 | Deploy Cloudflare Pages + docs ภาษาไทย + pilot | DoD §19 ครบ |

# AGENTS.md — กติการ่วมสำหรับ Claude และ Codex

1. อ่าน `PROJECT_SPEC.md`, `ARCHITECTURE.md`, `TASKS.md` ก่อนเริ่มทุกครั้ง
2. เลือก task สถานะ `todo` ที่ dependency เสร็จแล้ว → เปลี่ยนเป็น `in-progress (<agent>)` พร้อมรายการไฟล์ที่จะแตะ ใน PR แรกหรือ commit แรก
3. Branch: `feat/P2-05-submit-quest`, `fix/…`, `docs/…`
4. ก่อน commit: `npm run lint && npm run typecheck && npm test && npm run build` (+ `supabase test db` ถ้าแตะ DB)
5. Conventional Commits: `feat(quests): add submit_quest rpc`
6. PR ต้องมี: Task ID, สรุป, ไฟล์ที่เปลี่ยน, วิธีทดสอบ, screenshot (UI) → ให้อีก agent review
7. อัปเดต `TASKS.md` และ `CHANGELOG.md` เมื่อ merge
8. ห้าม: แก้ branch ที่ยังไม่ merge ของอีก agent, เปลี่ยน stack/schema หลัก/architecture โดยไม่มี ADR + อนุมัติ, commit secrets, ใส่ mock data นอก `supabase/seed.sql`, คำนวณ XP/คะแนนฝั่ง client
9. ความรับผิดชอบหลัก: **Claude** = UX/UI, design system, frontend features, docs, review · **Codex** = repo/CI, DB, RLS, RPC, integrations, tests, deploy, review
10. ภาษา: เอกสารผู้ใช้/สื่อสาร = ไทย, code/identifier = English, UI string ผ่าน `lib/i18n` (th default)

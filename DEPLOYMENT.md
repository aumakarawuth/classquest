# DEPLOYMENT (0 บาท)
1. Supabase: สร้างโปรเจกต์ Free (region Singapore `ap-southeast-1`), **ไม่ผูกบัตร**; ตั้ง Auth → Google provider; Site URL = `https://classquest.pages.dev`
2. Google Cloud: สร้าง project **ไม่เปิด billing**; OAuth consent ประเภท **Internal** ภายใต้ Workspace for Education ของสถานศึกษา (ADR-0006) และตั้ง `allowed_email_domains`; redirect `https://<ref>.supabase.co/auth/v1/callback`
3. `supabase link && supabase db push` (ไม่รัน seed ใน production)
3.1 ตั้งผู้ดูแลระบบคนแรก: ให้ผู้ดูแลเข้าสู่ระบบด้วย Google 1 ครั้ง แล้วรันใน SQL Editor: `select private.bootstrap_admin('admin@<โดเมนสถานศึกษา>');` (ใช้ได้ครั้งเดียว — หลังจากนั้นจัดการผ่านหน้า Admin › ผู้ใช้งาน)
4. Cloudflare Pages (Free, ไม่ต้องซื้อโดเมน):
   - Workers & Pages › Create › Pages › Connect to Git › เลือก repo `classquest`
   - Production branch: `main` · Build command: `npm ci && npm run build` · Build output directory: `apps/web/dist` · Root directory: `/`
   - Environment variables (Production): `NODE_VERSION=22`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, (ถ้ามี) `VITE_GOOGLE_HOSTED_DOMAIN`
   - ได้ URL `https://<project>.pages.dev` → ใส่ใน Supabase Auth › URL Configuration (Site URL + Redirect `https://<project>.pages.dev/auth/callback`)
   - `public/_redirects` (SPA fallback) และ `public/_headers` (CSP และ security headers) ถูกใช้อัตโนมัติ — ถ้าเปลี่ยนโดเมน Supabase/ฝังบริการใหม่ ต้องแก้ CSP
   - Preview deployments ของทุก PR ได้ URL แยก (ไม่ต้องเพิ่มใน Supabase Redirect เว้นแต่จะทดสอบ login)
5. Secrets ของ Edge Functions: `supabase secrets set GEMINI_API_KEY=...` (optional)
6. GitHub Actions (ไม่ตั้งค่า = workflow ข้ามตัวเองโดยไม่ล้ม):
   - สร้างกุญแจ: `age-keygen -o classquest-backup.key` → เก็บไฟล์นี้ **นอก repository** ในที่ปลอดภัยของผู้ดูแล (ใช้ถอดรหัส)
   - GitHub › Settings › Secrets › Actions: `SUPABASE_DB_URL` (Connection string แบบ session pooler จาก Supabase › Project Settings › Database) และ `BACKUP_AGE_PUBLIC_KEY` (บรรทัด `public key: age1...`)
   - `keepalive.yml`: จันทร์/พฤหัส `select 1` กันโปรเจกต์ถูก pause
   - `backup.yml`: อาทิตย์ `pg_dump -Fc` → `age` → artifact 30 วัน → บันทึก `ops.last_backup_at`
   - repo เป็น public: artifact ดาวน์โหลดได้โดยผู้ใช้ GitHub ทุกคน แต่ถอดรหัสไม่ได้หากไม่มี private key
   - กู้คืน: `age -d -i classquest-backup.key classquest-*.dump.age > db.dump` แล้ว `pg_restore --no-owner -d "$TARGET_DB_URL" db.dump` (ซ้อมกับโปรเจกต์ทดสอบทุกต้นภาคเรียน)
7. Restore drill ทุกต้นภาคเรียน

## Pre-launch checklist (P8)
- [ ] Supabase Advisors (Security/Performance) ไม่มี error — บันทึกใน docs/SECURITY_REVIEW.md
- [ ] Load test 30 VU บน staging ผ่านเกณฑ์ — บันทึกใน TESTING.md (`tests/load/README.md`)
- [ ] ทดสอบ backup + restore จริง 1 ครั้ง
- [ ] ปิด Email provider ใน production
- [ ] ตั้ง `auth.allowed_email_domains` และ bootstrap admin
- [ ] ข้อความประกาศความเป็นส่วนตัวจากสถานศึกษา
- [ ] นำร่องกับนักเรียน 30 คน + เก็บ feedback

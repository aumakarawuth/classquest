# DEPLOYMENT (0 บาท)
1. Supabase: สร้างโปรเจกต์ Free (region Singapore `ap-southeast-1`), **ไม่ผูกบัตร**; ตั้ง Auth → Google provider; Site URL = `https://classquest.pages.dev`
2. Google Cloud: สร้าง project **ไม่เปิด billing**; OAuth consent (Internal ถ้าเป็น Workspace สถานศึกษา / External+Testing); redirect `https://<ref>.supabase.co/auth/v1/callback`
3. `supabase link && supabase db push` (ไม่รัน seed ใน production)
4. Cloudflare Pages: connect GitHub repo, build `npm run build`, output `apps/web/dist`, env `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; เพิ่ม `_redirects` (`/* /index.html 200`) และ `_headers` (CSP)
5. Secrets ของ Edge Functions: `supabase secrets set GEMINI_API_KEY=...` (optional)
6. GitHub Actions: `keepalive.yml` (cron 2 ครั้ง/สัปดาห์), `backup.yml` (pg_dump รายสัปดาห์, เข้ารหัส age, เก็บ artifact 30 วัน) — ใช้ secret `SUPABASE_DB_URL`
7. Restore drill ทุกต้นภาคเรียน

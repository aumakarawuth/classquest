# Load test — 30 students in one class period

> ห้ามกล่าวอ้างว่ารองรับ 30 คนพร้อมกันจนกว่าจะรันสคริปต์นี้กับ **staging** และบันทึกผลใน `TESTING.md`

## เตรียม (staging เท่านั้น)
1. สร้าง Supabase project สำหรับทดสอบ (Free) → `supabase db push` → รัน `supabase/seed.sql`
2. เปิด Auth › Providers › Email (เฉพาะ staging) แล้วตั้งรหัสผ่านให้บัญชีทดสอบ:
   ```bash
   psql "$STAGING_DB_URL" -v password="$LOAD_PASSWORD" -f tests/load/set_test_passwords.sql
   ```
   สคริปต์ปฏิเสธการทำงานถ้าพบบัญชีที่ไม่ใช่ `@example.test`
3. (ถ้าจะทดสอบแบบทดสอบ) สร้างและเผยแพร่แบบทดสอบในรายวิชาตัวอย่าง แล้วใช้ id เป็น `QUIZ_ID`

## รัน
```bash
k6 run -e SUPABASE_URL=https://<ref>.supabase.co -e ANON_KEY=<anon key> -e PASSWORD="$LOAD_PASSWORD" \
  -e QUIZ_ID=<quiz id> --summary-export=tests/load/results/summary.json tests/load/classroom.js
```
- 30 VU พร้อมกัน, คนละ 1 รอบ: เข้าสู่ระบบ → เปิดรายวิชา/roadmap/XP → อ่านและจบบทเรียน → ส่งภารกิจ → ทำแบบทดสอบ
- เกณฑ์: `http_req_duration p95 < 800 ms`, error < 1%
- ระหว่างรัน เปิด Supabase Dashboard › Reports ดู CPU/connection และบันทึก

## บันทึกผลใน TESTING.md
วันที่, region, จำนวน VU, p50/p95/max ต่อ request, error rate, CPU/RAM/connections จาก Dashboard, ข้อสังเกต

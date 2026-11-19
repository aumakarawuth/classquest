# ADR-0007: Deploy บน Vercel (Hobby) เพิ่มจาก Cloudflare Pages

- สถานะ: Accepted (ผู้รับผิดชอบโครงการขอให้ deploy บน Vercel)
- ตัดสินใจ: เพิ่ม `vercel.json` — build ที่ root ของ monorepo (`npm ci` → `npm run build`), output `apps/web/dist`, SPA rewrite ทุก path ไป `index.html`, security headers; แอปเป็น static SPA ไม่ใช้ Serverless Functions
- CSP: จะเพิ่มใน `vercel.json` หลัง merge งาน P8-prep (ย้าย inline script ออกก่อน)
- ข้อควรระวัง (ตรวจเงื่อนไขล่าสุด):
  - Vercel Hobby ฟรีแต่ระบุไว้สำหรับการใช้งานส่วนบุคคล/ไม่ใช่เชิงพาณิชย์ — การใช้ในสถานศึกษาควรยืนยันกับเงื่อนไขทางการ; ถ้าไม่เข้าเงื่อนไขใช้ Cloudflare Pages ตาม ADR-0001
  - ห้ามเปิด Pro trial หรือผูกบัตร (งบ 0 บาท)
  - ต้องเพิ่ม URL `*.vercel.app` ใน Supabase Auth redirect เมื่อเชื่อม Supabase

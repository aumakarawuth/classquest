# ADR-0002: Keep-alive และ Backup ด้วย GitHub Actions
- สถานะ: Proposed
- บริบท: Free project pause เมื่อไม่ใช้งาน ~7 วัน และไม่มี backup ดาวน์โหลดได้
- ตัดสินใจ: cron ping 2 ครั้ง/สัปดาห์; pg_dump รายสัปดาห์เข้ารหัส; ปุ่ม export ในแอป
- ความเสี่ยง: นโยบาย Supabase อาจเปลี่ยน → ตรวจทุกภาคเรียน

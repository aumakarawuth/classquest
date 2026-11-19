# ADR-0001: ใช้ Supabase Free + Cloudflare Pages
- สถานะ: Proposed
- บริบท: ต้อง 0 บาท, ต้องมี RLS และ SQL สำหรับ analytics
- ตัดสินใจ: SPA static บน Cloudflare Pages, backend Supabase (Postgres/Auth/Storage/Edge)
- ทางเลือก: Firebase Spark (ไม่มี SQL/RLS แบบ relational), Vercel Hobby (ห้ามใช้เชิงพาณิชย์/องค์กร — ไม่ชัดสำหรับสถานศึกษา), self-host (ไม่เสถียร)
- ผลกระทบ: ต้องจัดการ project pause และ backup เอง (ADR-0002)

# ADR-0005: AI Tutor เป็น Optional ปิดโดยค่าเริ่มต้น
- สถานะ: Proposed
- ตัดสินใจ: Edge function proxy, feature flag, per-user/global daily cap, PII scrub, system prompt ห้ามเฉลย quest ที่กำลังประเมิน, fallback Hint Library
- หมายเหตุ: Gemini free tier อาจนำข้อมูลไปใช้พัฒนา → แจ้งผู้ใช้ และต้องได้รับความเห็นชอบจากสถานศึกษาก่อนเปิด

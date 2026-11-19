# ADR-0003: คะแนน/XP เป็น Server-authoritative ผ่าน RPC
- สถานะ: Proposed
- ตัดสินใจ: ตาราง scoring ไม่มี write policy สำหรับ client; RPC SECURITY DEFINER + unique ledger + idempotency key
- ผลกระทบ: logic อยู่ใน SQL → ต้องมี pgTAP/integration tests

# ADR-0006: ใช้ Google Workspace for Education + OAuth แบบ Internal
- สถานะ: Accepted (ผู้รับผิดชอบโครงการยืนยันว่าสถานศึกษาใช้ Google Workspace for Education)
- ตัดสินใจ:
  - OAuth consent screen ประเภท **Internal** ใน Google Cloud project ที่อยู่ภายใต้ Workspace ของสถานศึกษา (ไม่เปิด billing)
  - ผลคือไม่ต้องผ่าน Google app verification และไม่ติดเพดาน 100 test users สำหรับ Classroom scopes (Phase B)
  - จำกัดการเข้าสู่ระบบเฉพาะโดเมนสถานศึกษา: ตรวจ claim `hd` ใน trigger สร้าง profile ฝั่ง DB (`system_settings.allowed_email_domains`) — ไม่พึ่งการตรวจฝั่ง client
  - ผู้ใช้โดเมนที่อนุญาตยังต้องผ่าน Account Approval (status=pending) ตามเดิม
- ข้อควรทำ: ขอสิทธิ์ผู้ดูแล Workspace (IT สถานศึกษา) สร้าง project/อนุญาตแอปใน Admin Console › Security › API controls
- ผลกระทบ: บัญชี Gmail ส่วนตัวเข้าไม่ได้โดยค่าเริ่มต้น; admin เพิ่มโดเมน/ข้อยกเว้นได้ใน System Settings

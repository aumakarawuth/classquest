# ADR-0004: Google Classroom แบบ Phase A (link/CSV) ก่อน Phase B (API)
- สถานะ: Proposed
- เหตุผล: scope ของ Classroom ต้อง OAuth verification ในบางกรณี และระบบต้องใช้ได้เมื่อ API ไม่พร้อม
- Phase B ใช้ scope read-only (courses.readonly, rosters.readonly, coursework.me/students.readonly) และเขียนกลับเฉพาะเมื่อครูยืนยัน

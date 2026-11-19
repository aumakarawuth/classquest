# Security Review Checklist (P8-02)

สถานะ: ✅ ตรวจแล้วอัตโนมัติ (CI) · 🟡 ต้องตรวจกับ Supabase จริง · ⬜ ยังไม่ได้ทำ

## 1. สิทธิ์และข้อมูล (RLS)
| ข้อ | สถานะ | หลักฐาน |
|---|---|---|
| ทุกตาราง public เปิด RLS และมี policy | ✅ | `supabase/tests/database/01_schema.test.sql` |
| SECURITY DEFINER ทุกตัวตั้ง `search_path` | ✅ | `01_schema.test.sql` |
| นักเรียนเปลี่ยน role / status ของตนไม่ได้ | ✅ | `10_auth_roles` |
| นักเรียนแก้ XP / คะแนน / ผลประเมิน / สมรรถนะไม่ได้ | ✅ | `90_reviews_xp`, `d0_competencies`, `f0_quiz_attempts` |
| นักเรียนเห็นคะแนนของผู้อื่นไม่ได้ | ✅ | `20_courses`, `80_quests`, `f0`, `c0_leaderboard` |
| เข้าถึงรายวิชาที่ไม่ได้ลงทะเบียนไม่ได้ | ✅ | `20_courses`, `50_learning_enrollment` |
| เฉลยไม่ถึง client ก่อนเวลา | ✅ | `e0_quizzes`, `f0_quiz_attempts` + e2e/unit |
| ไฟล์งาน: เฉพาะเจ้าของ/ครูผู้สอน, 2 MB, MIME allowlist | ✅ policy / 🟡 ขนาดและ MIME (Storage API) | `80_quests` |
| แบบประเมินไม่ระบุตัวตน: ครูอ่านแถวคำตอบไม่ได้ | ✅ | `l0_evidence` |
| ตรวจ Supabase Security/Performance Advisors | 🟡 | รันหลังสร้าง project, บันทึกผลที่นี่ |

## 2. Authentication
| ข้อ | สถานะ |
|---|---|
| Google OAuth แบบ Internal (Workspace สถานศึกษา) | 🟡 รอ IT |
| จำกัดโดเมนอีเมลที่ DB trigger | ✅ `30_anon_domain` |
| ผู้ใช้ใหม่ pending จนกว่าจะอนุมัติ / role จาก admin เท่านั้น | ✅ |
| Redirect URL อนุญาตเฉพาะ `*.pages.dev` ของโครงการ + localhost | 🟡 ตั้งใน Supabase Auth |
| ปิด Email provider ใน production (เปิดเฉพาะ staging สำหรับ load test) | 🟡 |

## 3. Frontend
| ข้อ | สถานะ |
|---|---|
| ไม่มี `dangerouslySetInnerHTML`; Markdown ไม่ render HTML, ตัดลิงก์ `javascript:` | ✅ unit test |
| ลิงก์ภายนอก `rel="noopener noreferrer"` | ✅ |
| CSP (`script-src 'self'`, ไม่มี inline script), `frame-ancestors 'none'`, nosniff, Referrer-Policy | ✅ `public/_headers` + `e2e/csp.spec.ts` |
| iframe เฉพาะ youtube-nocookie / wokwi (sandbox) | ✅ |
| CSV export กัน formula injection | ✅ unit test |
| ไม่มี secret ใน bundle (เฉพาะ `VITE_SUPABASE_URL` / anon key) | ✅ ตรวจ `.env.example`; ⬜ เพิ่ม gitleaks ใน CI (P1-02) |

## 4. ปฏิบัติการ
| ข้อ | สถานะ |
|---|---|
| Spend cap / ไม่ผูกบัตรกับ Supabase, Cloudflare, Google Cloud | 🟡 ผู้ดูแลยืนยัน |
| Backup เข้ารหัสรายสัปดาห์ + ซ้อมกู้คืน | 🟡 ตั้ง secret แล้วรัน `backup.yml` |
| Keep-alive | 🟡 |
| Audit log: role, status, export, คะแนนมือ, badge มอบเอง, leaderboard | ✅ |

## 5. PDPA
| ข้อ | สถานะ |
|---|---|
| เก็บข้อมูลเท่าที่จำเป็น / activity วันละ 1 แถว | ✅ |
| Portfolio private โดยค่าเริ่มต้น / Leaderboard opt-in | ✅ |
| รายงานเผยแพร่ใช้รหัสนิรนาม | ✅ |
| ประกาศความเป็นส่วนตัวภาษาไทยในหน้าเข้าสู่ระบบ | ⬜ ต้องได้ข้อความจากสถานศึกษา |
| ขั้นตอนลบ/ส่งออกข้อมูลรายบุคคลตามคำขอ | ⬜ ปัจจุบันทำโดย admin ผ่าน SQL — ควรมี RPC |

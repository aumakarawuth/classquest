# FREE_TIER_BUDGET

> ⚠️ ตัวเลขด้านล่างอ้างอิงเอกสารทางการตามความรู้ของทีม ณ พ.ย. 2026 **ต้องตรวจสอบซ้ำที่หน้า pricing ทางการก่อน Deploy จริง** (TASK P0-03) และบันทึกวันที่ตรวจสอบ

## 1. Limits (ต้องยืนยัน)
| บริการ | Limit สำคัญ (Free) | แหล่งตรวจสอบ |
|---|---|---|
| Supabase | DB 500 MB, Storage 1 GB, Egress 5 GB/เดือน, 50,000 MAU, Edge Functions 500K invocations/เดือน, 2 active projects, **pause เมื่อไม่ใช้งาน 1 สัปดาห์**, ไม่มี PITR/backup ดาวน์โหลด | supabase.com/pricing , docs/guides/platform/billing-on-supabase |
| Cloudflare Pages | Builds 500/เดือน, 1 build พร้อมกัน, static bandwidth/requests ไม่จำกัด, ≤ 20,000 ไฟล์, ไฟล์ละ ≤ 25 MiB; Pages Functions นับโควตา Workers (100K req/วัน) | developers.cloudflare.com/pages/platform/limits |
| GitHub Actions | Public repo: ฟรีไม่จำกัดนาทีบน standard runner; Private: 2,000 นาที/เดือน | docs.github.com/billing |
| Google Classroom API | ฟรี, quota ต่อโปรเจกต์/ผู้ใช้; OAuth app ที่ยังไม่ verify จำกัด 100 test users | developers.google.com/classroom |
| Gemini API | Free tier มี RPM/RPD จำกัดตามรุ่น, ข้อมูลใน free tier อาจถูกใช้พัฒนาผลิตภัณฑ์ | ai.google.dev/gemini-api/docs/rate-limits , /pricing |

**กฎความปลอดภัยด้านค่าใช้จ่าย**: ไม่ผูกบัตรเครดิตกับ Supabase/Cloudflare; Google Cloud project สำหรับ OAuth/Gemini **ไม่เปิด billing account**; Supabase "Spend cap" ต้องอยู่สถานะ ON (หรือไม่มี plan แบบจ่ายเงิน)

## 2. ประมาณการการใช้งาน (30 นักเรียน + 3 ครู, 18 สัปดาห์)
| รายการ | สมมติฐาน | ประมาณการ | % ของ limit |
|---|---|---|---|
| DB rows | events 30×40/วัน×126 วัน ≈ 150K; submissions ~3K; answers ~30K; ledger ~10K | ~200K rows ≈ 60–100 MB (รวม index) | ~20% ของ 500 MB |
| Storage | 30 คน × 15 ไฟล์ × ≤ 2 MB (เฉลี่ย 400 KB) | ~180 MB | ~18% ของ 1 GB |
| Egress (Supabase) | API JSON ~2 MB/คน/คาบ × 3 คาบ/สัปดาห์ × 30 คน + storage views | ~0.8–1.5 GB/เดือน | ~30% ของ 5 GB |
| Frontend bandwidth | Cloudflare static ไม่จำกัด | — | — |
| Auth MAU | 33 | 33 | <0.1% |
| Edge Functions | AI Tutor 30 คน × 10 req/วัน + CSV/Classroom | ~10K/เดือน | ~2% |
| Gemini | cap 10 req/คน/วัน, 300/วัน ทั้งระบบ | ต่ำกว่า RPD free | ตั้งค่าได้ |
| Builds | ~3–5 deploy/วัน | ~120/เดือน | 24% |

**สรุป**: เพียงพอสำหรับ 1 ห้อง 30 คนพร้อมเผื่อ 3–5 เท่า; ความเสี่ยงหลักคือ **project pause** และ **egress จากรูปภาพ** → บีบอัดรูปฝั่ง client (≤ 1600px, WebP) และใช้ Drive/YouTube สำหรับสื่อขนาดใหญ่

## 3. Monitoring
หน้า Admin › Quota แสดง: DB size (`pg_database_size`), storage usage (sum `storage.objects.metadata->size`), จำนวน AI calls ต่อวัน, วันที่ backup ล่าสุด; ตัวเลข egress ให้ admin ดูจาก Supabase dashboard (ไม่มี API ฟรี) — แสดงลิงก์

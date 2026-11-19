-- =====================================================================================
-- DEVELOPMENT / TEST SEED ONLY — NEVER RUN AGAINST PRODUCTION.
-- All people are fictional (@example.test). Contains no real student data and no
-- learning results: nothing here may be used as competition evidence.
-- Run by `supabase db reset` locally, or `supabase/tests/local/run.sh --seed`.
-- =====================================================================================

do $$
begin
  if exists (select 1 from auth.users where email not like '%@example.test') then
    raise exception 'Refusing to seed: database contains non-test accounts (production?)';
  end if;
end $$;

-- ---------------------------------------------------------------- people
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-4000-a000-000000000001', 'admin@example.test', '{"full_name":"ผู้ดูแลระบบ (ทดสอบ)"}'),
  ('00000000-0000-4000-a000-000000000002', 'teacher@example.test', '{"full_name":"ครูทดสอบ ระบบไอโอที"}');

insert into auth.users (id, email, raw_user_meta_data)
select ('00000000-0000-4000-b000-' || lpad(n::text, 12, '0'))::uuid,
       'student' || lpad(n::text, 2, '0') || '@example.test',
       jsonb_build_object('full_name', 'นักเรียนทดสอบ ' || lpad(n::text, 2, '0'))
from generate_series(1, 30) n;

update public.profiles set status = 'active', approved_at = now();
update public.profiles p set nickname = 'Player' || substr(p.email, 8, 2), student_code = 'TEST-' || substr(p.email, 8, 2)
 where p.email like 'student%';

insert into public.user_roles (user_id, role) values
  ('00000000-0000-4000-a000-000000000001', 'admin'),
  ('00000000-0000-4000-a000-000000000002', 'teacher');
insert into public.user_roles (user_id, role)
select id, 'student' from public.profiles where email like 'student%';

-- ---------------------------------------------------------------- course (created as the teacher)
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a000-000000000002', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated"}', false);

insert into public.courses (id, code, name, level, classroom, term, academic_year, description, learning_outcomes,
  status, weeks, created_by)
values (
  '00000000-0000-4000-c000-000000000001', '31910-2012', 'อินเทอร์เน็ตเพื่อสรรพสิ่ง (Internet of Things)', 'pvs',
  'ปวส.1/1 (ทดสอบ)', 1, 2569,
  'ศึกษาและปฏิบัติเกี่ยวกับหลักการของอินเทอร์เน็ตเพื่อสรรพสิ่ง ไมโครคอนโทรลเลอร์ เซนเซอร์ การสื่อสารเครือข่าย และการพัฒนาระบบ IoT อย่างง่าย',
  E'1. อธิบายหลักการของระบบ IoT\n2. ต่อวงจรและเขียนโปรแกรมควบคุมอุปกรณ์\n3. พัฒนาระบบ IoT สำหรับแก้ปัญหาในชีวิตประจำวัน',
  'published', 18, '00000000-0000-4000-a000-000000000002');

-- weekly unit titles (18 units created by trigger)
update public.learning_units u set title = t.title, published = t.week <= 10
from (values
  (1, 'สัปดาห์ที่ 1: รู้จัก IoT'), (2, 'สัปดาห์ที่ 2: Hello Arduino'), (3, 'สัปดาห์ที่ 3: ควบคุม LED'),
  (4, 'สัปดาห์ที่ 4: สวิตช์และอินพุต'), (5, 'สัปดาห์ที่ 5: เซนเซอร์อัลตราโซนิก'),
  (6, 'สัปดาห์ที่ 6: ตรวจวัดสภาพแวดล้อม'), (7, 'สัปดาห์ที่ 7: เชื่อมต่อเครือข่าย'),
  (8, 'สัปดาห์ที่ 8: การสื่อสาร IoT'), (9, 'สัปดาห์ที่ 9: ควบคุมอุปกรณ์อัจฉริยะ'),
  (10, 'สัปดาห์ที่ 10–12: Boss Mission บ้านอัจฉริยะ')
) as t(week, title)
where u.course_id = '00000000-0000-4000-c000-000000000001' and u.position = t.week;

-- one lesson per mission week, QUEST stage cycles through the model
insert into public.lessons (id, unit_id, position, title, body_md, quest_stage, estimated_minutes, published)
select ('00000000-0000-4000-d000-' || lpad(u.position::text, 12, '0'))::uuid, u.id, 1,
       'บทเรียน: ' || split_part(u.title, ': ', 2),
       E'## สถานการณ์ปัญหา\nข้อมูลตัวอย่างสำหรับการพัฒนาระบบ — ครูจะแทนที่ด้วยเนื้อหาจริง\n\n## สิ่งที่จะได้เรียนรู้\n- แนวคิดหลักของหัวข้อนี้\n- การทดลองผ่าน Virtual Lab',
       (array['question', 'understand', 'experiment', 'solve', 'transfer']::public.quest_stage[])[1 + (u.position - 1) % 5],
       45, true
from public.learning_units u
where u.course_id = '00000000-0000-4000-c000-000000000001' and u.position <= 10;

update public.lessons l set prerequisite_lesson_id = p.id
from public.lessons p
where l.course_id = '00000000-0000-4000-c000-000000000001'
  and p.course_id = l.course_id
  and p.id = ('00000000-0000-4000-d000-' || lpad((right(l.id::text, 2)::int - 1)::text, 12, '0'))::uuid;

insert into public.lesson_resources (lesson_id, position, type, title, url)
select l.id, 1, 'lab', 'เปิดโปรเจกต์ Arduino ใหม่ใน Wokwi', 'https://wokwi.com/projects/new/arduino-uno'
from public.lessons l where l.course_id = '00000000-0000-4000-c000-000000000001';

-- ---------------------------------------------------------------- quests (Mission 01–09 + Boss)
insert into public.quests (id, course_id, unit_id, type, title, description_md, objectives, quest_stage,
  difficulty, max_score, xp_reward, submit_modes, max_attempts, position, published)
select ('00000000-0000-4000-e000-' || lpad(m.n::text, 12, '0'))::uuid,
       '00000000-0000-4000-c000-000000000001', u.id, m.qtype::public.quest_type, m.title,
       E'ภารกิจตัวอย่างสำหรับการพัฒนาระบบ\n\n**ส่งงาน:** ลิงก์โปรเจกต์ Wokwi และคำอธิบายการทำงาน',
       m.objective,
       (array['question', 'understand', 'experiment', 'solve', 'transfer']::public.quest_stage[])[1 + (m.n - 1) % 5],
       m.difficulty, case when m.qtype = 'boss' then 30 else 10 end, m.xp,
       array['text', 'url', 'file'], 3, m.n, true
from (values
  (1, 'main', 'Mission 01: Introduction to IoT', 'อธิบายองค์ประกอบของระบบ IoT', 1, 100),
  (2, 'main', 'Mission 02: Hello Arduino', 'เขียนโปรแกรมแรกบน Arduino', 1, 100),
  (3, 'main', 'Mission 03: LED Controller', 'ควบคุม LED ด้วย digitalWrite', 2, 120),
  (4, 'main', 'Mission 04: Switch and Input', 'อ่านค่าสวิตช์และตอบสนอง', 2, 120),
  (5, 'main', 'Mission 05: Ultrasonic Sensor', 'วัดระยะทางด้วยเซนเซอร์อัลตราโซนิก', 3, 150),
  (6, 'main', 'Mission 06: Environmental Monitoring', 'อ่านค่าอุณหภูมิและความชื้น', 3, 150),
  (7, 'main', 'Mission 07: Network Connectivity', 'เชื่อมต่อ ESP32 กับ Wi-Fi', 3, 150),
  (8, 'main', 'Mission 08: IoT Communication', 'ส่งข้อมูลผ่านโปรโตคอล IoT', 4, 180),
  (9, 'main', 'Mission 09: Smart Device Controller', 'ควบคุมอุปกรณ์ผ่านเครือข่าย', 4, 180),
  (10, 'boss', 'Boss Mission: Smart Home Solution', 'ออกแบบและพัฒนาระบบบ้านอัจฉริยะ', 5, 500)
) as m(n, qtype, title, objective, difficulty, xp)
join public.learning_units u on u.course_id = '00000000-0000-4000-c000-000000000001' and u.position = m.n;

insert into public.quest_prerequisites (quest_id, required_quest_id)
select ('00000000-0000-4000-e000-' || lpad(n::text, 12, '0'))::uuid,
       ('00000000-0000-4000-e000-' || lpad((n - 1)::text, 12, '0'))::uuid
from generate_series(2, 10) n;

select public.save_quest_rubric('00000000-0000-4000-e000-000000000003',
  '[{"name":"ต่อวงจรถูกต้อง","max_points":4},{"name":"โค้ดทำงานตามโจทย์","max_points":4},{"name":"อธิบายการทำงาน","max_points":2}]');

-- ---------------------------------------------------------------- enrollment: 30 students + a code
insert into public.course_members (course_id, user_id, member_role)
select '00000000-0000-4000-c000-000000000001', id, 'student' from public.profiles where email like 'student%';
insert into public.enrollment_codes (course_id, code, created_by)
values ('00000000-0000-4000-c000-000000000001', 'DEVIOT01', '00000000-0000-4000-a000-000000000002');

-- ---------------------------------------------------------------- a few pending submissions (review queue in dev)
select set_config('request.jwt.claims', '', false);
insert into public.quest_submissions (quest_id, course_id, user_id, attempt_no, content_text, url)
select '00000000-0000-4000-e000-000000000001', '00000000-0000-4000-c000-000000000001', p.id, 1,
       'งานตัวอย่างสำหรับทดสอบหน้าตรวจงาน', 'https://wokwi.com/projects/new/arduino-uno'
from public.profiles p where p.email in ('student01@example.test', 'student02@example.test', 'student03@example.test');

select set_config('request.jwt.claim.sub', '', false);

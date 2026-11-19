begin;
select plan(11);

select tests.create_user('a5000000-0000-0000-0000-00000000000a', 't@school.test', 'active', 'teacher');
select tests.create_user('a5000000-0000-0000-0000-00000000000b', 's1@school.test', 'active', 'student');
select tests.create_user('a5000000-0000-0000-0000-00000000000c', 's2@school.test', 'active', 'student');
select tests.act_as('a5000000-0000-0000-0000-00000000000a');
insert into public.courses (id, code, name, level, term, academic_year, created_by, weeks, status)
values ('a5c00000-0000-0000-0000-000000000001', 'EV', 'Evidence', 'pvs', 1, 2569, 'a5000000-0000-0000-0000-00000000000a', 1, 'published');
insert into public.course_members (course_id, user_id, member_role) values
  ('a5c00000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-00000000000b', 'student'),
  ('a5c00000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-00000000000c', 'student');
select lives_ok($$ insert into public.competition_evidence (course_id, category, title, body_md)
  values ('a5c00000-0000-0000-0000-000000000001', 'problem_needs', 'ผลสำรวจปัญหา', 'นักเรียนขาดแรงจูงใจ') $$, 'teacher adds evidence');
insert into public.surveys (id, course_id, title, items, anonymous, open) values
  ('a5500000-0000-0000-0000-000000000001', 'a5c00000-0000-0000-0000-000000000001', 'ความพึงพอใจ',
   '[{"id":"q1","text":"กิจกรรมสนุก","type":"likert"},{"id":"q2","text":"ข้อเสนอแนะ","type":"text"}]', true, true);

select tests.act_as('a5000000-0000-0000-0000-00000000000b');
select is_empty($$ select * from public.competition_evidence $$, 'students cannot see the evidence center');
select throws_ok($$ select public.submit_survey('a5500000-0000-0000-0000-000000000001', '{"q1": 7}') $$, '23514', null, 'likert must be 1..5');
select throws_ok($$ select public.submit_survey('a5500000-0000-0000-0000-000000000001', '{"zz": 3}') $$, '23514', null, 'unknown item rejected');
select lives_ok($$ select public.submit_survey('a5500000-0000-0000-0000-000000000001', '{"q1": 5, "q2": "ชอบ Virtual Lab"}') $$, 'student responds');
select lives_ok($$ select public.submit_survey('a5500000-0000-0000-0000-000000000001', '{"q1": 4}') $$, 'responding again replaces the answer');
select tests.act_as('a5000000-0000-0000-0000-00000000000c');
select public.submit_survey('a5500000-0000-0000-0000-000000000001', '{"q1": 2}');
select throws_ok($$ select public.survey_summary('a5500000-0000-0000-0000-000000000001') $$, '42501', null, 'students cannot read summaries');

select tests.act_as('a5000000-0000-0000-0000-00000000000a');
select is_empty($$ select * from public.survey_responses $$, 'teacher cannot read raw rows of an anonymous survey');
select is((select public.survey_summary('a5500000-0000-0000-0000-000000000001') -> 'items' -> 0 ->> 'mean')::numeric, 3.00,
  'mean of latest answers (4, 2)');
select is((select (public.survey_summary('a5500000-0000-0000-0000-000000000001') ->> 'respondents')::int), 2, 'two respondents');
select ok((select public.survey_summary('a5500000-0000-0000-0000-000000000001')::text !~ 's1@school|a5000000-0000-0000-0000-00000000000b'),
  'summary contains no identities');

select * from finish(true);
rollback;

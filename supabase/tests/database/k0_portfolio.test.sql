begin;
select plan(10);

select tests.create_user('a4000000-0000-0000-0000-00000000000a', 't@school.test', 'active', 'teacher');
select tests.create_user('a4000000-0000-0000-0000-00000000000b', 's@school.test', 'active', 'student');
select tests.create_user('a4000000-0000-0000-0000-00000000000c', 's2@school.test', 'active', 'student');
update public.badges set active = false;
select tests.act_as('a4000000-0000-0000-0000-00000000000a');
insert into public.courses (id, code, name, level, term, academic_year, created_by, weeks, status)
values ('a4c00000-0000-0000-0000-000000000001', 'PF', 'Portfolio', 'pvc', 1, 2569, 'a4000000-0000-0000-0000-00000000000a', 1, 'published');
insert into public.course_members (course_id, user_id, member_role) values
  ('a4c00000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-00000000000b', 'student'),
  ('a4c00000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-00000000000c', 'student');
insert into public.quests (id, course_id, title, published) values
  ('a4a00000-0000-0000-0000-000000000001', 'a4c00000-0000-0000-0000-000000000001', 'Smart Home', true),
  ('a4a00000-0000-0000-0000-000000000002', 'a4c00000-0000-0000-0000-000000000001', 'Pending', true);

select tests.act_as('a4000000-0000-0000-0000-00000000000b');
create temporary table t_s on commit drop as select
  (public.submit_quest('a4a00000-0000-0000-0000-000000000001', 'งานบ้านอัจฉริยะ')).id as ok,
  (public.submit_quest('a4a00000-0000-0000-0000-000000000002', 'ยังไม่ตรวจ')).id as pend;
grant select on t_s to authenticated;
select tests.act_as('a4000000-0000-0000-0000-00000000000a');
select public.review_submission((select ok from t_s), 'approved', 10, 'ยอดเยี่ยม', null, 'pf-approve-01');

select tests.act_as('a4000000-0000-0000-0000-00000000000b');
insert into public.portfolios (user_id, course_id) values ('a4000000-0000-0000-0000-00000000000b', 'a4c00000-0000-0000-0000-000000000001');
select is((select visibility from public.portfolios), 'private', 'portfolio is private by default');
select lives_ok($$ insert into public.portfolio_items (user_id, course_id, submission_id, title)
  values ('a4000000-0000-0000-0000-00000000000b', 'a4c00000-0000-0000-0000-000000000001', (select ok from t_s), 'บ้านอัจฉริยะ') $$,
  'student features own approved work');
select throws_ok($$ insert into public.portfolio_items (user_id, course_id, submission_id, title)
  values ('a4000000-0000-0000-0000-00000000000b', 'a4c00000-0000-0000-0000-000000000001', (select pend from t_s), 'x') $$,
  '23514', null, 'cannot feature unapproved work');
insert into public.student_reflections (user_id, course_id, body) values
  ('a4000000-0000-0000-0000-00000000000b', 'a4c00000-0000-0000-0000-000000000001', 'ได้เรียนรู้การต่อเซนเซอร์');

select tests.act_as('a4000000-0000-0000-0000-00000000000a');
select is_empty($$ select * from public.portfolio_items $$, 'teacher cannot see a private portfolio');
select is((select count(*)::int from public.student_reflections), 1, 'teacher can read reflections (learning evidence)');

select tests.act_as('a4000000-0000-0000-0000-00000000000b');
update public.portfolios set visibility = 'teacher';
select tests.act_as('a4000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.portfolio_items), 1, 'teacher sees portfolio once shared');

select tests.act_as('a4000000-0000-0000-0000-00000000000c');
select is_empty($$ select * from public.portfolio_items $$, 'classmates never see others'' portfolios');
select is_empty($$ select * from public.student_reflections $$, 'classmates never see others'' reflections');
select throws_ok($$ insert into public.student_reflections (user_id, course_id, body)
  values ('a4000000-0000-0000-0000-00000000000b', 'a4c00000-0000-0000-0000-000000000001', 'forged') $$, '42501', null,
  'cannot write reflections for someone else');
select throws_ok($$ insert into public.portfolio_items (user_id, course_id, submission_id, title)
  values ('a4000000-0000-0000-0000-00000000000c', 'a4c00000-0000-0000-0000-000000000001', (select ok from t_s), 'stolen') $$,
  '23514', null, 'cannot feature someone else''s work');

select * from finish(true);
rollback;

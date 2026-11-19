begin;
select plan(7);

select tests.create_user('90000000-0000-0000-0000-0000000000a1', 't@school.test', 'active', 'teacher');
select tests.create_user('90000000-0000-0000-0000-0000000000b1', 'a@school.test', 'active', 'student');
select tests.create_user('90000000-0000-0000-0000-0000000000b2', 'b@school.test', 'active', 'student');
select tests.create_user('90000000-0000-0000-0000-0000000000b3', 'c@school.test', 'active', 'student');
update public.profiles set display_name = 'นักเรียน ' || right(email, 13) where email like '%@school.test';
update public.badges set active = false;
select tests.act_as('90000000-0000-0000-0000-0000000000a1');
insert into public.courses (id, code, name, level, term, academic_year, created_by, weeks, status)
values ('9c000000-0000-0000-0000-0000000000a1', 'PP', 'PrePost', 'pvc', 1, 2569, '90000000-0000-0000-0000-0000000000a1', 1, 'published');
insert into public.course_members (course_id, user_id, member_role)
select '9c000000-0000-0000-0000-0000000000a1', u::uuid, 'student'
  from unnest(array['90000000-0000-0000-0000-0000000000b1', '90000000-0000-0000-0000-0000000000b2', '90000000-0000-0000-0000-0000000000b3']) u;
insert into public.quizzes (id, course_id, kind, title, published, max_attempts) values
  ('9f000000-0000-0000-0000-0000000000a1', '9c000000-0000-0000-0000-0000000000a1', 'pretest', 'Pre', true, 2),
  ('9f000000-0000-0000-0000-0000000000a2', '9c000000-0000-0000-0000-0000000000a1', 'posttest', 'Post', true, 1);
select tests.reset_actor();
-- real attempts would be created by start/submit; here we insert graded rows directly as superuser fixtures
insert into public.quiz_attempts (quiz_id, course_id, user_id, attempt_no, question_ids, status, score, max_score) values
  ('9f000000-0000-0000-0000-0000000000a1', '9c000000-0000-0000-0000-0000000000a1', '90000000-0000-0000-0000-0000000000b1', 1, '{}', 'graded', 4, 10),
  ('9f000000-0000-0000-0000-0000000000a1', '9c000000-0000-0000-0000-0000000000a1', '90000000-0000-0000-0000-0000000000b1', 2, '{}', 'graded', 9, 10),
  ('9f000000-0000-0000-0000-0000000000a2', '9c000000-0000-0000-0000-0000000000a1', '90000000-0000-0000-0000-0000000000b1', 1, '{}', 'graded', 8, 10),
  ('9f000000-0000-0000-0000-0000000000a1', '9c000000-0000-0000-0000-0000000000a1', '90000000-0000-0000-0000-0000000000b2', 1, '{}', 'graded', 5, 10);

select tests.act_as('90000000-0000-0000-0000-0000000000a1');
select results_eq($$ select pre_percent, post_percent, gain, normalized_gain from public.prepost_report(
    '9c000000-0000-0000-0000-0000000000a1', '9f000000-0000-0000-0000-0000000000a1', '9f000000-0000-0000-0000-0000000000a2', false)
   where student like '%a@school.test' $$,
  $$ values (40.00::numeric, 80.00::numeric, 40.00::numeric, 0.667::numeric) $$, 'first attempt used; gain and normalized gain');
select is((select count(*)::int from public.prepost_report('9c000000-0000-0000-0000-0000000000a1',
  '9f000000-0000-0000-0000-0000000000a1', '9f000000-0000-0000-0000-0000000000a2', false)), 3, 'every student listed (missing tests = null)');
select is((select gain from public.prepost_report('9c000000-0000-0000-0000-0000000000a1',
  '9f000000-0000-0000-0000-0000000000a1', '9f000000-0000-0000-0000-0000000000a2', false) where student like '%b@school.test'), null,
  'no gain without a post-test (never fabricated)');
select ok((select bool_and(student ~ '^S[0-9]{2}$') from public.prepost_report('9c000000-0000-0000-0000-0000000000a1',
  '9f000000-0000-0000-0000-0000000000a1', '9f000000-0000-0000-0000-0000000000a2', true)), 'anonymized report uses S-codes only');
create temporary table t1 on commit drop as select array_agg(student order by student) s from public.prepost_report('9c000000-0000-0000-0000-0000000000a1',
  '9f000000-0000-0000-0000-0000000000a1', '9f000000-0000-0000-0000-0000000000a2', true);
select is((select array_agg(student order by student) from public.prepost_report('9c000000-0000-0000-0000-0000000000a1',
  '9f000000-0000-0000-0000-0000000000a1', '9f000000-0000-0000-0000-0000000000a2', true)), (select s from t1), 'codes are stable');

select tests.act_as('90000000-0000-0000-0000-0000000000b1');
select throws_ok($$ select * from public.prepost_report('9c000000-0000-0000-0000-0000000000a1',
  '9f000000-0000-0000-0000-0000000000a1', '9f000000-0000-0000-0000-0000000000a2', false) $$, '42501', null, 'students cannot run the report');
select is_empty($$ select * from public.anonymous_codes $$, 'students cannot read the anonymous code mapping');

select * from finish(true);
rollback;

begin;
select plan(9);

select tests.create_user('a3000000-0000-0000-0000-00000000000a', 't@school.test', 'active', 'teacher');
select tests.create_user('a3000000-0000-0000-0000-00000000000b', 'active@school.test', 'active', 'student');
select tests.create_user('a3000000-0000-0000-0000-00000000000c', 'idle@school.test', 'active', 'student');
update public.badges set active = false;
select tests.act_as('a3000000-0000-0000-0000-00000000000a');
insert into public.courses (id, code, name, level, term, academic_year, created_by, weeks, status)
values ('a3c00000-0000-0000-0000-000000000001', 'DB', 'Dash', 'pvc', 1, 2569, 'a3000000-0000-0000-0000-00000000000a', 1, 'published');
update public.learning_units set published = true where course_id = 'a3c00000-0000-0000-0000-000000000001';
insert into public.lessons (id, unit_id, position, title, published)
select v.id, u.id, v.pos, v.t, true from public.learning_units u,
  (values ('a3e00000-0000-0000-0000-000000000001'::uuid, 1, 'L1'), ('a3e00000-0000-0000-0000-000000000002'::uuid, 2, 'L2')) v(id, pos, t)
 where u.course_id = 'a3c00000-0000-0000-0000-000000000001';
insert into public.course_members (course_id, user_id, member_role) values
  ('a3c00000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-00000000000b', 'student'),
  ('a3c00000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-00000000000c', 'student');

select tests.act_as('a3000000-0000-0000-0000-00000000000b');
select public.touch_activity();
select public.touch_activity();
select public.complete_lesson('a3e00000-0000-0000-0000-000000000001');
select public.complete_lesson('a3e00000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.activity_days), 1, 'one activity row per day');
select throws_ok($$ select public.teacher_dashboard('a3c00000-0000-0000-0000-000000000001') $$, '42501', null, 'students cannot open the dashboard');

select tests.act_as('a3000000-0000-0000-0000-00000000000a');
create temporary table t_d on commit drop as select public.teacher_dashboard('a3c00000-0000-0000-0000-000000000001') d;
select is((select (d ->> 'students_total')::int from t_d), 2, 'students total');
select is((select (d ->> 'active_7d')::int from t_d), 1, 'active in last 7 days (real activity only)');
select is((select (d ->> 'lesson_completion_rate')::numeric from t_d), 50.0, '2 of 4 lesson completions = 50%');
select is((select (d ->> 'pretest_mean') from t_d), null, 'no pre-test data → null, not zero');
select ok((select 'inactive_7d' = any (array(select jsonb_array_elements_text(s -> 'flags')))
             from t_d, jsonb_array_elements(d -> 'students') s where s ->> 'display_name' like 'idle%'),
  'never-active student flagged as needing support');
select is((select jsonb_array_length(s -> 'flags') from t_d, jsonb_array_elements(d -> 'students') s
            where s ->> 'display_name' like 'active%'), 0, 'active, on-track student not flagged');
select is((select d -> 'students' -> 0 ->> 'display_name' from t_d), 'idle', 'students needing support are listed first');

select * from finish(true);
rollback;

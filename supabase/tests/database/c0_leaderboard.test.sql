begin;
select plan(10);

select tests.create_user('c0000000-0000-0000-0000-00000000000a', 't@school.test', 'active', 'teacher');
select tests.create_user('c0000000-0000-0000-0000-00000000000b', 's1@school.test', 'active', 'student');
select tests.create_user('c0000000-0000-0000-0000-00000000000c', 's2@school.test', 'active', 'student');
select tests.create_user('c0000000-0000-0000-0000-00000000000d', 'out@school.test', 'active', 'student');
update public.profiles set leaderboard_opt_in = true, nickname = 'Neo' where id = 'c0000000-0000-0000-0000-00000000000b';
update public.badges set active = false;

select tests.act_as('c0000000-0000-0000-0000-00000000000a');
insert into public.courses (id, code, name, level, term, academic_year, created_by, weeks, status)
values ('cc000000-0000-0000-0000-000000000001', 'LB', 'Board', 'pvc', 1, 2569, 'c0000000-0000-0000-0000-00000000000a', 1, 'published');
insert into public.course_members (course_id, user_id, member_role) values
  ('cc000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000b', 'student'),
  ('cc000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c', 'student');
select tests.reset_actor();
insert into public.xp_transactions (user_id, course_id, amount, source_type, source_id, reason) values
  ('c0000000-0000-0000-0000-00000000000b', 'cc000000-0000-0000-0000-000000000001', 120, 'manual', gen_random_uuid(), 't'),
  ('c0000000-0000-0000-0000-00000000000c', 'cc000000-0000-0000-0000-000000000001', 500, 'manual', gen_random_uuid(), 't');

select tests.act_as('c0000000-0000-0000-0000-00000000000b');
select is_empty($$ select * from public.get_leaderboard('cc000000-0000-0000-0000-000000000001') $$, 'off by default');
select throws_ok($$ select public.set_course_leaderboard('cc000000-0000-0000-0000-000000000001', true) $$, '42501', null,
  'student cannot enable leaderboard');

select tests.act_as('c0000000-0000-0000-0000-00000000000a');
select public.set_course_leaderboard('cc000000-0000-0000-0000-000000000001', true);
select tests.act_as('c0000000-0000-0000-0000-00000000000b');
select is_empty($$ select * from public.get_leaderboard('cc000000-0000-0000-0000-000000000001') $$,
  'still off while the system-wide flag is off');

select tests.reset_actor();
update public.system_settings set value = 'true' where key = 'feature.leaderboard';
select tests.act_as('c0000000-0000-0000-0000-00000000000b');
select results_eq($$ select rank, nickname, level::int, xp, is_me from public.get_leaderboard('cc000000-0000-0000-0000-000000000001') $$,
  $$ values (1, 'Neo'::text, 2, 120, true) $$, 'only opted-in students appear (s2 has more XP but did not opt in)');
select is((select count(*)::int from information_schema.routines r
            join information_schema.parameters p on p.specific_name = r.specific_name
           where r.routine_name = 'get_leaderboard' and p.parameter_mode = 'OUT'
             and p.parameter_name in ('email', 'display_name', 'student_code', 'score')), 0,
  'leaderboard exposes no email, real name, student code or scores');

select tests.act_as('c0000000-0000-0000-0000-00000000000c');
update public.profiles set leaderboard_opt_in = true, nickname = '' where id = 'c0000000-0000-0000-0000-00000000000c';
select results_eq($$ select rank, nickname, is_me from public.get_leaderboard('cc000000-0000-0000-0000-000000000001') order by rank $$,
  $$ values (1, 'ผู้เล่นนิรนาม'::text, true), (2, 'Neo'::text, false) $$, 'opt-in works; blank nickname is anonymised');
update public.profiles set leaderboard_opt_in = false where id = 'c0000000-0000-0000-0000-00000000000c';
select is((select count(*)::int from public.get_leaderboard('cc000000-0000-0000-0000-000000000001')), 1, 'opt-out removes the student');

select tests.act_as('c0000000-0000-0000-0000-00000000000d');
select throws_ok($$ select * from public.get_leaderboard('cc000000-0000-0000-0000-000000000001') $$, '42501', null,
  'non-member cannot read the leaderboard');
select is_empty($$ select * from public.leaderboard_status('cc000000-0000-0000-0000-000000000001') $$, 'non-member gets no status');

select tests.reset_actor();
select is((select count(*)::int from public.audit_logs where action = 'course.leaderboard_toggled'), 1, 'toggle audited');

select * from finish(true);
rollback;

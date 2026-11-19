begin;
select plan(13);

select tests.create_user('a1000000-0000-0000-0000-00000000000a', 't@school.test', 'active', 'teacher');
select tests.create_user('a1000000-0000-0000-0000-00000000000b', 'existing@school.test', 'pending');
select tests.create_user('a1000000-0000-0000-0000-00000000000e', 'teacher2@school.test', 'pending');
insert into public.user_roles (user_id, role) values ('a1000000-0000-0000-0000-00000000000e', 'teacher');
update public.badges set active = false;
select tests.act_as('a1000000-0000-0000-0000-00000000000a');
insert into public.courses (id, code, name, level, term, academic_year, created_by, weeks, status)
values ('a1c00000-0000-0000-0000-000000000001', 'RS', 'Roster', 'pvc', 1, 2569, 'a1000000-0000-0000-0000-00000000000a', 1, 'published');

select is(public.import_roster('a1c00000-0000-0000-0000-000000000001', '[
  {"email":"Existing@School.test","student_code":"66001"},
  {"email":"newbie@school.test","student_code":"66002","display_name":"นักเรียนใหม่"},
  {"email":"teacher2@school.test"},
  {"email":"not-an-email"}]'),
  '{"invited": 3, "enrolled_now": 2, "invalid": 1}'::jsonb, 'import summary');
select tests.reset_actor();
select results_eq($$ select status::text, student_code from public.profiles where id = 'a1000000-0000-0000-0000-00000000000b' $$,
  $$ values ('active', '66001') $$, 'existing pending account approved as student and code set');
select is((select array_agg(role::text) from public.user_roles where user_id = 'a1000000-0000-0000-0000-00000000000b'),
  array['student'], 'only the student role is granted');
select is((select status::text from public.profiles where id = 'a1000000-0000-0000-0000-00000000000e'), 'pending',
  'an account that already has another role is not auto-approved');

-- new student signs in later → claimed automatically
insert into auth.users (id, email) values ('a1000000-0000-0000-0000-00000000000c', 'newbie@school.test');
select is((select count(*)::int from public.course_members where user_id = 'a1000000-0000-0000-0000-00000000000c'), 1,
  'first sign-in enrolls the invited student');
select is((select status::text from public.profiles where id = 'a1000000-0000-0000-0000-00000000000c'), 'active', 'and approves them');
select is((select count(*)::int from public.roster_invites where claimed_at is null), 0, 'all valid invites claimed');

select tests.act_as('a1000000-0000-0000-0000-00000000000c');
select throws_ok($$ select public.import_roster('a1c00000-0000-0000-0000-000000000001', '[]') $$, '42501', null, 'students cannot import');
select is_empty($$ select * from public.roster_invites $$, 'students cannot read invites');
select throws_ok($$ select public.gradebook_export('a1c00000-0000-0000-0000-000000000001') $$, '42501', null, 'students cannot export grades');
select throws_ok($$ insert into public.classroom_connections (course_id, gc_link) values ('a1c00000-0000-0000-0000-000000000001', 'https://classroom.google.com/c/x') $$,
  '42501', null, 'students cannot set the Classroom link');

select tests.act_as('a1000000-0000-0000-0000-00000000000a');
select throws_ok($$ insert into public.classroom_connections (course_id, gc_link) values ('a1c00000-0000-0000-0000-000000000001', 'https://evil.example') $$,
  '23514', null, 'only classroom.google.com links');
select is(jsonb_array_length(public.gradebook_export('a1c00000-0000-0000-0000-000000000001') -> 'students'), 3,
  'gradebook lists every enrolled student (3 valid invites)');

select * from finish(true);
rollback;

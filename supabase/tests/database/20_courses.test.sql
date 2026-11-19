begin;
select plan(12);

select tests.create_user('20000000-0000-0000-0000-00000000000a', 'teacher@school.test', 'active', 'teacher');
select tests.create_user('20000000-0000-0000-0000-00000000000b', 'teacher2@school.test', 'active', 'teacher');
select tests.create_user('20000000-0000-0000-0000-00000000000c', 'student@school.test', 'active', 'student');
select tests.create_user('20000000-0000-0000-0000-00000000000d', 'outsider@school.test', 'active', 'student');

select tests.act_as('20000000-0000-0000-0000-00000000000a');
select lives_ok($$
  insert into public.courses (id, code, name, level, term, academic_year, created_by)
  values ('2c000000-0000-0000-0000-000000000001', '31910-2012', 'IoT', 'pvs', 1, 2569,
          '20000000-0000-0000-0000-00000000000a') $$, 'teacher creates course');
select is((select member_role::text from public.course_members
           where course_id = '2c000000-0000-0000-0000-000000000001'
             and user_id = '20000000-0000-0000-0000-00000000000a'), 'teacher', 'creator becomes teacher member');
select throws_ok($$
  insert into public.courses (code, name, level, term, academic_year, created_by)
  values ('X1', 'X', 'pvc', 1, 2569, '20000000-0000-0000-0000-00000000000b') $$,
  '42501', null, 'teacher cannot create course as someone else');
select lives_ok($$
  insert into public.course_members (course_id, user_id, member_role)
  values ('2c000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-00000000000c', 'student') $$,
  'teacher enrolls student');
select is((select count(*)::int from public.profiles), 2, 'teacher sees self + own students only');

select tests.act_as('20000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.courses), 1, 'student sees enrolled course');
select throws_ok($$
  insert into public.courses (code, name, level, term, academic_year, created_by)
  values ('X2', 'X', 'pvc', 1, 2569, '20000000-0000-0000-0000-00000000000c') $$,
  '42501', null, 'student cannot create course');
select is_empty($$ update public.courses set name = 'hacked' returning id $$, 'student cannot edit course');
select is_empty($$ select * from public.enrollment_codes $$, 'student cannot read enrollment codes');
select throws_ok($$
  insert into public.course_members (course_id, user_id, member_role)
  values ('2c000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-00000000000d', 'student') $$,
  '42501', null, 'student cannot enroll others');

select tests.act_as('20000000-0000-0000-0000-00000000000d');
select is_empty($$ select * from public.courses $$, 'outsider cannot see course');

select tests.act_as('20000000-0000-0000-0000-00000000000b');
select is_empty($$ select * from public.course_members where course_id = '2c000000-0000-0000-0000-000000000001' $$,
  'other teacher cannot see roster');

select * from finish(true);
rollback;

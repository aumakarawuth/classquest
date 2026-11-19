begin;
select plan(10);

-- new users: pending, no role even if metadata claims one
insert into auth.users (id, email, raw_user_meta_data)
values ('10000000-0000-0000-0000-000000000001', 'hacker@school.test', '{"role":"admin","full_name":"H"}');
select is((select status::text from public.profiles where id = '10000000-0000-0000-0000-000000000001'),
  'pending', 'new user is pending');
select is((select count(*)::int from public.user_roles where user_id = '10000000-0000-0000-0000-000000000001'),
  0, 'metadata never grants a role');

select tests.create_user('10000000-0000-0000-0000-000000000002', 'student@school.test', 'active', 'student');
select tests.create_user('10000000-0000-0000-0000-000000000003', 'admin@school.test', 'active', 'admin');

select tests.act_as('10000000-0000-0000-0000-000000000002');
select throws_ok(
  $$ insert into public.user_roles (user_id, role) values ('10000000-0000-0000-0000-000000000002', 'admin') $$,
  '42501', null, 'student cannot grant self a role');
select throws_ok(
  $$ update public.user_roles set role = 'admin' where user_id = '10000000-0000-0000-0000-000000000002' $$,
  '42501', null, 'student cannot change own role');
select throws_ok(
  $$ update public.profiles set status = 'active' where id = '10000000-0000-0000-0000-000000000002' $$,
  '42501', null, 'student cannot change own status');
select lives_ok(
  $$ update public.profiles set nickname = 'Neo' where id = '10000000-0000-0000-0000-000000000002' $$,
  'student can edit own nickname');
select is((select count(*)::int from public.profiles), 1, 'student sees only own profile');
select is((select count(*)::int from public.audit_logs), 0, 'student cannot read audit logs');

-- pending user has no effective role
select tests.reset_actor();
insert into public.user_roles (user_id, role) values ('10000000-0000-0000-0000-000000000001', 'teacher');
select tests.act_as('10000000-0000-0000-0000-000000000001');
select is(private.has_role('teacher'), false, 'pending user gets no role privileges');

select tests.act_as('10000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.profiles), 3, 'admin sees all profiles');

select * from finish(true);
rollback;

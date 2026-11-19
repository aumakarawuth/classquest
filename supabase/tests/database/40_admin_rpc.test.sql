begin;
select plan(14);

select tests.create_user('40000000-0000-0000-0000-00000000000a', 'admin@school.test', 'active', 'admin');
select tests.create_user('40000000-0000-0000-0000-00000000000b', 'teacher@school.test', 'active', 'teacher');
insert into auth.users (id, email) values ('40000000-0000-0000-0000-00000000000c', 'new@school.test');

-- non-admin cannot use admin RPCs
select tests.act_as('40000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.admin_set_user_status('40000000-0000-0000-0000-00000000000c', 'active') $$,
  '42501', null, 'teacher cannot approve users');
select throws_ok($$ select public.admin_set_user_role('40000000-0000-0000-0000-00000000000b', 'admin', true) $$,
  '42501', null, 'teacher cannot grant self admin');

-- admin approves and grants a role
select tests.act_as('40000000-0000-0000-0000-00000000000a');
select is((public.admin_set_user_status('40000000-0000-0000-0000-00000000000c', 'active')).status::text,
  'active', 'admin approves user');
select is((select approved_by from public.profiles where id = '40000000-0000-0000-0000-00000000000c'),
  '40000000-0000-0000-0000-00000000000a'::uuid, 'approver recorded');
select results_eq($$ select public.admin_set_user_role('40000000-0000-0000-0000-00000000000c', 'student', true) $$,
  $$ values ('student'::public.app_role) $$, 'admin grants student role');
select lives_ok($$ select public.admin_set_user_role('40000000-0000-0000-0000-00000000000c', 'student', true) $$,
  'granting twice is idempotent');
select is((select count(*)::int from public.audit_logs where action = 'user.role_granted'), 1,
  'idempotent grant audited once');
select is((select count(*)::int from public.audit_logs where action = 'user.status_changed'), 1,
  'status change audited');
select results_eq($$ select public.admin_set_user_role('40000000-0000-0000-0000-00000000000c', 'student', false) $$,
  $$ select null::public.app_role where false $$, 'admin revokes role');
select is((select count(*)::int from public.audit_logs where action = 'user.role_revoked'), 1, 'revoke audited');

-- self-lockout protection
select throws_ok($$ select public.admin_set_user_role('40000000-0000-0000-0000-00000000000a', 'admin', false) $$,
  '23514', null, 'admin cannot remove own admin role');
select throws_ok($$ select public.admin_set_user_status('40000000-0000-0000-0000-00000000000a', 'suspended') $$,
  '23514', null, 'admin cannot suspend self');

-- suspended user loses privileges
select public.admin_set_user_status('40000000-0000-0000-0000-00000000000b', 'suspended');
select tests.act_as('40000000-0000-0000-0000-00000000000b');
select is(private.has_role('teacher'), false, 'suspended teacher has no teacher privileges');

-- audit trail is readable by admin only
select is_empty($$ select * from public.audit_logs $$, 'non-admin cannot read audit trail');

select * from finish(true);
rollback;

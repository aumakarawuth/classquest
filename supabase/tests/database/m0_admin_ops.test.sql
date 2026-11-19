begin;
select plan(7);

select tests.create_user('a6000000-0000-0000-0000-00000000000a', 'admin@school.test', 'active', 'admin');
select tests.create_user('a6000000-0000-0000-0000-00000000000b', 't@school.test', 'active', 'teacher');

select tests.act_as('a6000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.admin_quota() $$, '42501', null, 'teachers cannot read quota');
select throws_ok($$ select public.admin_export() $$, '42501', null, 'teachers cannot export the system');
select is_empty($$ update public.system_settings set value = 'true' where key = 'feature.leaderboard' returning key $$,
  'teachers cannot change system settings (RLS: no rows updated)');

select tests.act_as('a6000000-0000-0000-0000-00000000000a');
select ok((public.admin_quota() ->> 'db_bytes')::bigint > 0, 'quota reports database size');
select ok(public.admin_export() -> 'tables' ? 'profiles', 'export contains application tables');
select lives_ok($$ update public.system_settings set value = 'true' where key = 'feature.leaderboard' $$, 'admin changes settings');
select tests.reset_actor();
select is((select count(*)::int from public.audit_logs where action = 'system.exported'), 1, 'export audited');

select * from finish(true);
rollback;

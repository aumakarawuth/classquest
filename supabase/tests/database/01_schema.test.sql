begin;
select plan(4);

select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0,
  'every public table has RLS enabled'
);

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)),
  0,
  'every public table has at least one policy'
);

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  0,
  'every SECURITY DEFINER function pins search_path'
);

select is(
  (select value from public.system_settings where key = 'feature.ai_tutor'),
  'false'::jsonb,
  'AI tutor is off by default'
);

select * from finish(true);
rollback;

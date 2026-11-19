-- Shared test helpers (created in schema `tests`, used by later files in the same run).
-- Runs under `supabase test db` and under supabase/tests/local/run.sh.
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

create or replace function tests.create_user(_id uuid, _email text, _status public.account_status default 'active',
  _role public.app_role default null) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  insert into auth.users (id, email, raw_user_meta_data) values (_id, _email, '{}'::jsonb);
  update public.profiles set status = _status where id = _id;
  if _role is not null then
    insert into public.user_roles (user_id, role) values (_id, _role);
  end if;
  return _id;
end $$;

create or replace function tests.act_as(_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', _id::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function tests.act_as_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
end $$;

create or replace function tests.reset_actor() returns void
language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

grant execute on all functions in schema tests to anon, authenticated;

begin;
select plan(1);
select has_function('tests', 'act_as', array['uuid'], 'test helpers installed');
select * from finish(true);
rollback;

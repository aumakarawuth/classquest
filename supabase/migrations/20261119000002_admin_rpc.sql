-- P1-08: admin RPCs for account approval and role management. Every change is audited.

create function public.admin_set_user_status(_user_id uuid, _status public.account_status)
returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  old_row public.profiles;
  new_row public.profiles;
begin
  if not private.has_role('admin') then
    raise exception 'CQ_FORBIDDEN' using errcode = '42501';
  end if;
  if _user_id = (select auth.uid()) and _status <> 'active' then
    raise exception 'CQ_SELF_LOCKOUT: cannot deactivate your own account' using errcode = 'check_violation';
  end if;

  select * into old_row from public.profiles where id = _user_id for update;
  if not found then
    raise exception 'CQ_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  if old_row.status = _status then
    return old_row; -- idempotent
  end if;

  update public.profiles
     set status = _status,
         approved_at = case when _status = 'active' then coalesce(approved_at, now()) else approved_at end,
         approved_by = case when _status = 'active' then coalesce(approved_by, (select auth.uid())) else approved_by end
   where id = _user_id
  returning * into new_row;

  perform private.write_audit('user.status_changed', 'profiles', _user_id,
    jsonb_build_object('status', old_row.status), jsonb_build_object('status', new_row.status));
  return new_row;
end $$;

create function public.admin_set_user_role(_user_id uuid, _role public.app_role, _grant boolean)
returns setof public.app_role
language plpgsql security definer set search_path = '' as $$
declare
  changed integer;
begin
  if not private.has_role('admin') then
    raise exception 'CQ_FORBIDDEN' using errcode = '42501';
  end if;
  if _user_id = (select auth.uid()) and _role = 'admin' and not _grant then
    raise exception 'CQ_SELF_LOCKOUT: cannot remove your own admin role' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.profiles where id = _user_id) then
    raise exception 'CQ_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  if _grant then
    insert into public.user_roles (user_id, role, granted_by)
    values (_user_id, _role, (select auth.uid()))
    on conflict (user_id, role) do nothing;
  else
    delete from public.user_roles where user_id = _user_id and role = _role;
  end if;
  get diagnostics changed = row_count;

  if changed > 0 then
    perform private.write_audit(
      case when _grant then 'user.role_granted' else 'user.role_revoked' end,
      'user_roles', _user_id, null, jsonb_build_object('role', _role));
  end if;

  return query select role from public.user_roles where user_id = _user_id order by role;
end $$;

revoke all on function public.admin_set_user_status(uuid, public.account_status) from public, anon;
revoke all on function public.admin_set_user_role(uuid, public.app_role, boolean) from public, anon;
grant execute on function public.admin_set_user_status(uuid, public.account_status) to authenticated;
grant execute on function public.admin_set_user_role(uuid, public.app_role, boolean) to authenticated;

-- First admin bootstrap: run once from the Supabase SQL editor (service role), see DEPLOYMENT.md.
create function private.bootstrap_admin(_email text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid;
begin
  if exists (select 1 from public.user_roles where role = 'admin') then
    raise exception 'CQ_ADMIN_EXISTS: an admin already exists; use the admin UI';
  end if;
  select id into uid from public.profiles where lower(email) = lower(_email);
  if uid is null then
    raise exception 'CQ_NOT_FOUND: sign in once with % before bootstrapping', _email;
  end if;
  update public.profiles set status = 'active', approved_at = now() where id = uid;
  insert into public.user_roles (user_id, role) values (uid, 'admin') on conflict do nothing;
  insert into public.audit_logs (actor_id, action, entity, entity_id, after)
  values (null, 'user.admin_bootstrapped', 'user_roles', uid, jsonb_build_object('role', 'admin'));
  return uid;
end $$;
revoke all on function private.bootstrap_admin(text) from public, authenticated;

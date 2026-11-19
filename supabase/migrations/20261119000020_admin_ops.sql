-- P6-04: admin quota monitoring, full JSON export, operational settings.

insert into public.system_settings (key, value, description) values
  ('ops.last_backup_at', 'null', 'เวลาสำรองข้อมูลล่าสุด (บันทึกโดย GitHub Actions backup workflow)'),
  ('ops.free_tier_limits', '{"db_bytes": 524288000, "storage_bytes": 1073741824, "egress_bytes_month": 5368709120, "mau": 50000}',
   'ขีดจำกัด Free Tier ที่ใช้เทียบ (ตรวจสอบกับหน้า pricing ทางการแล้วปรับได้)')
on conflict (key) do nothing;

create function public.admin_quota() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  storage_bytes bigint := 0;
begin
  if not private.has_role('admin') then
    raise exception 'CQ_FORBIDDEN' using errcode = '42501';
  end if;
  if to_regclass('storage.objects') is not null then
    execute 'select coalesce(sum((metadata ->> ''size'')::bigint), 0) from storage.objects' into storage_bytes;
  end if;
  return jsonb_build_object(
    'db_bytes', pg_database_size(current_database()),
    'storage_bytes', storage_bytes,
    'limits', (select value from public.system_settings where key = 'ops.free_tier_limits'),
    'last_backup_at', (select value from public.system_settings where key = 'ops.last_backup_at'),
    'users', (select count(*) from public.profiles),
    'active_users_30d', (select count(distinct user_id) from public.activity_days where day > current_date - 30),
    'courses', (select count(*) from public.courses),
    'submissions', (select count(*) from public.quest_submissions),
    'quiz_attempts', (select count(*) from public.quiz_attempts),
    'xp_transactions', (select count(*) from public.xp_transactions),
    'audit_logs', (select count(*) from public.audit_logs),
    'largest_tables', (select jsonb_agg(t) from (
        select c.relname as name, pg_total_relation_size(c.oid) as bytes
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r'
         order by pg_total_relation_size(c.oid) desc limit 8) t));
end $$;

-- Full logical export of application data (JSON). For 1–3 classes this is small; disaster recovery
-- uses the encrypted pg_dump from GitHub Actions. Every export is audited.
create function public.admin_export() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  result jsonb := '{}'::jsonb;
  t text;
  rows jsonb;
begin
  if not private.has_role('admin') then
    raise exception 'CQ_FORBIDDEN' using errcode = '42501';
  end if;
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' order by c.relname
  loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x', t) into rows;
    result := result || jsonb_build_object(t, rows);
  end loop;
  perform private.write_audit('system.exported', 'system', null, null,
    jsonb_build_object('tables', (select count(*) from jsonb_object_keys(result))));
  return jsonb_build_object('exported_at', now(), 'format', 'classquest-export-v1', 'tables', result);
end $$;

-- called by the backup workflow (service role / DB owner) after a successful dump
create function private.mark_backup() returns void
language sql security definer set search_path = '' as $$
  update public.system_settings set value = to_jsonb(now()) where key = 'ops.last_backup_at';
$$;
revoke all on function private.mark_backup() from public, authenticated;

revoke all on function public.admin_quota(), public.admin_export() from public, anon;
grant execute on function public.admin_quota(), public.admin_export() to authenticated;

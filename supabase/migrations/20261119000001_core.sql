-- P1-05: core schema — profiles, roles, settings, courses, membership, enrollment codes, audit log.
-- Conventions: uuid PKs, timestamptz, RLS on every table, helpers in schema `private`,
-- privileged writes only through SECURITY DEFINER functions (search_path = '').

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------- enums
create type public.app_role as enum ('admin', 'teacher', 'student');
create type public.account_status as enum ('pending', 'active', 'suspended');
create type public.course_status as enum ('draft', 'published', 'archived');
create type public.course_level as enum ('pvc', 'pvs'); -- ปวช. / ปวส.
create type public.member_role as enum ('teacher', 'student');

-- ---------------------------------------------------------------- shared trigger
create function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- system_settings
create table public.system_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger system_settings_updated_at before update on public.system_settings
  for each row execute function private.set_updated_at();

insert into public.system_settings (key, value, description) values
  ('auth.allowed_email_domains', '[]', 'โดเมนอีเมลที่อนุญาตให้สมัคร (ว่าง = ไม่จำกัด) — ADR-0006'),
  ('feature.ai_tutor', 'false', 'เปิด/ปิด AI Tutor (ADR-0005)'),
  ('feature.classroom_api', 'false', 'เปิด/ปิด Google Classroom API (Phase B)'),
  ('feature.leaderboard', 'false', 'เปิด/ปิด Leaderboard ทั้งระบบ'),
  ('feature.wokwi_embed', 'false', 'อนุญาต embed Wokwi (ค่าเริ่มต้นเปิดเป็นลิงก์)'),
  ('app.timezone', '"Asia/Bangkok"', 'เขตเวลาของระบบ');

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null check (char_length(display_name) between 1 and 120),
  nickname text check (char_length(nickname) <= 40),
  student_code text unique check (char_length(student_code) <= 32),
  avatar_url text,
  status public.account_status not null default 'pending',
  leaderboard_opt_in boolean not null default false,
  approved_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_status_idx on public.profiles (status);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------- user_roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, role)
);
create trigger user_roles_updated_at before update on public.user_roles
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------- courses
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null check (char_length(code) between 1 and 32),
  name text not null check (char_length(name) between 1 and 200),
  level public.course_level not null,
  classroom text not null default '' check (char_length(classroom) <= 60),
  term smallint not null check (term between 1 and 3),
  academic_year smallint not null check (academic_year between 2500 and 2700), -- พ.ศ.
  description text,
  learning_outcomes text,
  cover_path text,
  status public.course_status not null default 'draft',
  weeks smallint not null default 18 check (weeks between 1 and 40),
  settings jsonb not null default '{}'::jsonb,
  source_course_id uuid references public.courses (id) on delete set null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code, academic_year, term, classroom)
);
create index courses_status_idx on public.courses (status);
create index courses_created_by_idx on public.courses (created_by);
create trigger courses_updated_at before update on public.courses
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------- course_members
create table public.course_members (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  member_role public.member_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, user_id)
);
create index course_members_user_idx on public.course_members (user_id);
create trigger course_members_updated_at before update on public.course_members
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------- enrollment_codes
create table public.enrollment_codes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{6,12}$'),
  expires_at timestamptz,
  max_uses integer check (max_uses > 0),
  uses integer not null default 0 check (uses >= 0),
  is_active boolean not null default true,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index enrollment_codes_course_idx on public.enrollment_codes (course_id);
create trigger enrollment_codes_updated_at before update on public.enrollment_codes
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------- audit_logs (append-only)
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity, entity_id);

-- ---------------------------------------------------------------- helper functions
create function private.has_role(_role public.app_role) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles r
    join public.profiles p on p.id = r.user_id
    where r.user_id = (select auth.uid()) and r.role = _role and p.status = 'active'
  );
$$;

create function private.is_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'active');
$$;

create function private.is_course_member(_course_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_active() and exists (
    select 1 from public.course_members
    where course_id = _course_id and user_id = (select auth.uid())
  );
$$;

create function private.is_course_teacher(_course_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role('teacher') and exists (
    select 1 from public.course_members
    where course_id = _course_id and user_id = (select auth.uid()) and member_role = 'teacher'
  );
$$;

revoke all on all functions in schema private from public;
grant execute on function private.has_role(public.app_role), private.is_active(),
  private.is_course_member(uuid), private.is_course_teacher(uuid) to authenticated;

create function private.write_audit(_action text, _entity text, _entity_id uuid, _before jsonb, _after jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs (actor_id, action, entity, entity_id, before, after)
  values ((select auth.uid()), _action, _entity, _entity_id, _before, _after);
$$;
revoke all on function private.write_audit(text, text, uuid, jsonb, jsonb) from public;

-- ---------------------------------------------------------------- new-user trigger (domain restriction, ADR-0006)
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  allowed jsonb;
  domain text := lower(split_part(new.email, '@', 2));
begin
  select value into allowed from public.system_settings where key = 'auth.allowed_email_domains';
  if allowed is not null and jsonb_array_length(allowed) > 0
     and not exists (select 1 from jsonb_array_elements_text(allowed) d where lower(d) = domain) then
    raise exception 'CQ_DOMAIN_NOT_ALLOWED: email domain % is not allowed', domain
      using errcode = 'check_violation';
  end if;

  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  -- No role is granted here: roles are assigned by an admin (never from client metadata).
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- creator of a course becomes its teacher member
create function private.add_course_creator() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.course_members (course_id, user_id, member_role)
  values (new.id, new.created_by, 'teacher');
  return new;
end $$;
create trigger courses_add_creator after insert on public.courses
  for each row execute function private.add_course_creator();

-- ---------------------------------------------------------------- RLS
alter table public.system_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.courses enable row level security;
alter table public.course_members enable row level security;
alter table public.enrollment_codes enable row level security;
alter table public.audit_logs enable row level security;

-- anon gets nothing
revoke all on all tables in schema public from anon;

-- system_settings: active users read, admins write
create policy settings_read on public.system_settings for select to authenticated
  using ((select private.is_active()));
create policy settings_admin_write on public.system_settings for all to authenticated
  using ((select private.has_role('admin'))) with check ((select private.has_role('admin')));

-- profiles: self, teachers of shared courses, admins
create policy profiles_read on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or (select private.has_role('admin'))
  or exists (
    select 1 from public.course_members me
    join public.course_members them on them.course_id = me.course_id
    where me.user_id = (select auth.uid()) and me.member_role = 'teacher'
      and them.user_id = profiles.id and (select private.has_role('teacher'))
  )
);
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- column-level: users may only edit cosmetic fields; status/email/approval are admin-RPC only
revoke update on public.profiles from authenticated;
grant update (display_name, nickname, avatar_url, leaderboard_opt_in) on public.profiles to authenticated;
revoke insert, delete on public.profiles from authenticated;

-- user_roles: read own or admin; no client writes (admin RPC in P1-08)
create policy user_roles_read on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_role('admin')));
revoke insert, update, delete on public.user_roles from authenticated;

-- courses
create policy courses_read on public.courses for select to authenticated using (
  (select private.has_role('admin'))
  or (select private.is_course_member(id))
);
create policy courses_insert on public.courses for insert to authenticated
  with check ((select private.has_role('teacher')) and created_by = (select auth.uid()));
create policy courses_update on public.courses for update to authenticated
  using ((select private.is_course_teacher(id)) or (select private.has_role('admin')))
  with check ((select private.is_course_teacher(id)) or (select private.has_role('admin')));
create policy courses_delete on public.courses for delete to authenticated
  using ((select private.has_role('admin')));

-- course_members: own rows, course teachers manage, admins
create policy members_read on public.course_members for select to authenticated using (
  user_id = (select auth.uid())
  or (select private.is_course_teacher(course_id))
  or (select private.has_role('admin'))
);
create policy members_teacher_write on public.course_members for all to authenticated
  using ((select private.is_course_teacher(course_id)) or (select private.has_role('admin')))
  with check ((select private.is_course_teacher(course_id)) or (select private.has_role('admin')));

-- enrollment_codes: course teachers only (students join via RPC in P2-02)
create policy codes_teacher on public.enrollment_codes for all to authenticated
  using ((select private.is_course_teacher(course_id)))
  with check ((select private.is_course_teacher(course_id)) and created_by = (select auth.uid()));

-- audit_logs: admins read; writes only through private.write_audit
create policy audit_admin_read on public.audit_logs for select to authenticated
  using ((select private.has_role('admin')));
revoke insert, update, delete on public.audit_logs from authenticated;

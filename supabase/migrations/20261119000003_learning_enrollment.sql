-- P2-01: learning units / lessons / resources / progress
-- P2-02: enrollment codes (server-generated), join by code, clone course

create type public.quest_stage as enum ('question', 'understand', 'experiment', 'solve', 'transfer');
create type public.resource_type as enum (
  'text', 'image', 'video', 'pdf', 'drive', 'slides', 'youtube', 'code', 'external', 'interactive', 'lab');
create type public.progress_status as enum ('in_progress', 'completed');

-- ---------------------------------------------------------------- learning_units
create table public.learning_units (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  position smallint not null check (position >= 1),
  week_no smallint check (week_no between 1 and 40),
  title text not null check (char_length(title) between 1 and 200),
  description text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, position) deferrable initially deferred
);
create trigger learning_units_updated_at before update on public.learning_units
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------- lessons
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.learning_units (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade, -- denormalised for RLS
  position smallint not null check (position >= 1),
  title text not null check (char_length(title) between 1 and 200),
  body_md text not null default '' check (char_length(body_md) <= 50000),
  quest_stage public.quest_stage,
  prerequisite_lesson_id uuid references public.lessons (id) on delete set null,
  estimated_minutes smallint check (estimated_minutes between 1 and 600),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, position) deferrable initially deferred,
  check (prerequisite_lesson_id is distinct from id)
);
create index lessons_course_idx on public.lessons (course_id);
create trigger lessons_updated_at before update on public.lessons
  for each row execute function private.set_updated_at();

create function private.lesson_course_matches_unit() returns trigger
language plpgsql set search_path = '' as $$
begin
  select course_id into new.course_id from public.learning_units where id = new.unit_id;
  return new;
end $$;
create trigger lessons_course_from_unit before insert or update of unit_id on public.lessons
  for each row execute function private.lesson_course_matches_unit();

-- ---------------------------------------------------------------- lesson_resources
create table public.lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  position smallint not null check (position >= 1),
  type public.resource_type not null,
  title text not null default '' check (char_length(title) <= 200),
  url text check (url ~ '^https://' and char_length(url) <= 2000),
  storage_path text,
  content text check (char_length(content) <= 20000), -- text / code body
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (url is not null or storage_path is not null or content is not null)
);
create index lesson_resources_lesson_idx on public.lesson_resources (lesson_id, position);
create trigger lesson_resources_updated_at before update on public.lesson_resources
  for each row execute function private.set_updated_at();

create function private.resource_course_matches_lesson() returns trigger
language plpgsql set search_path = '' as $$
begin
  select course_id into new.course_id from public.lessons where id = new.lesson_id;
  return new;
end $$;
create trigger lesson_resources_course before insert or update of lesson_id on public.lesson_resources
  for each row execute function private.resource_course_matches_lesson();

-- ---------------------------------------------------------------- lesson_progress
create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.progress_status not null default 'in_progress',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, user_id)
);
create index lesson_progress_user_idx on public.lesson_progress (user_id);
create trigger lesson_progress_updated_at before update on public.lesson_progress
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------- default units on course creation
create function private.create_default_units() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.source_course_id is null then
    insert into public.learning_units (course_id, position, week_no, title)
    select new.id, w, w, 'สัปดาห์ที่ ' || w from generate_series(1, new.weeks) w;
  end if;
  return new;
end $$;
create trigger courses_default_units after insert on public.courses
  for each row execute function private.create_default_units();

-- ---------------------------------------------------------------- RLS
alter table public.learning_units enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_resources enable row level security;
alter table public.lesson_progress enable row level security;

-- students see published content of published courses they belong to; teachers see everything in their course
create function private.can_view_course_content(_course_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_course_teacher(_course_id) or private.has_role('admin')
      or (private.is_course_member(_course_id)
          and exists (select 1 from public.courses where id = _course_id and status = 'published'));
$$;
revoke all on function private.can_view_course_content(uuid) from public;
grant execute on function private.can_view_course_content(uuid) to authenticated;

create policy units_read on public.learning_units for select to authenticated using (
  (select private.is_course_teacher(course_id)) or (select private.has_role('admin'))
  or (published and (select private.can_view_course_content(course_id))));
create policy units_teacher_write on public.learning_units for all to authenticated
  using ((select private.is_course_teacher(course_id))) with check ((select private.is_course_teacher(course_id)));

create policy lessons_read on public.lessons for select to authenticated using (
  (select private.is_course_teacher(course_id)) or (select private.has_role('admin'))
  or (published and (select private.can_view_course_content(course_id))
      and exists (select 1 from public.learning_units u where u.id = unit_id and u.published)));
create policy lessons_teacher_write on public.lessons for all to authenticated
  using ((select private.is_course_teacher(course_id))) with check ((select private.is_course_teacher(course_id)));

create policy resources_read on public.lesson_resources for select to authenticated using (
  (select private.is_course_teacher(course_id)) or (select private.has_role('admin'))
  or exists (select 1 from public.lessons l where l.id = lesson_id)); -- inherits lessons RLS
create policy resources_teacher_write on public.lesson_resources for all to authenticated
  using ((select private.is_course_teacher(course_id))) with check ((select private.is_course_teacher(course_id)));

-- progress: own rows; teachers of the course read. Writes go through complete_lesson() (P2-04).
create policy progress_read on public.lesson_progress for select to authenticated using (
  user_id = (select auth.uid())
  or exists (select 1 from public.lessons l where l.id = lesson_id and (select private.is_course_teacher(l.course_id))));
revoke insert, update, delete on public.lesson_progress from authenticated;

-- ---------------------------------------------------------------- enrollment
create function public.create_enrollment_code(_course_id uuid, _expires_at timestamptz default null,
  _max_uses integer default null)
returns public.enrollment_codes
language plpgsql security definer set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I
  new_code text;
  row public.enrollment_codes;
begin
  if not private.is_course_teacher(_course_id) then
    raise exception 'CQ_FORBIDDEN' using errcode = '42501';
  end if;
  loop
    select string_agg(substr(alphabet, 1 + (get_byte(b, i) % length(alphabet)), 1), '')
      into new_code
      from (select extensions.gen_random_bytes(8) b) r, generate_series(0, 7) i;
    exit when not exists (select 1 from public.enrollment_codes where code = new_code);
  end loop;
  insert into public.enrollment_codes (course_id, code, expires_at, max_uses, created_by)
  values (_course_id, new_code, _expires_at, _max_uses, (select auth.uid()))
  returning * into row;
  return row;
end $$;

create function public.join_course_by_code(_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  ec public.enrollment_codes;
  course_status public.course_status;
begin
  if not private.has_role('student') then
    raise exception 'CQ_FORBIDDEN' using errcode = '42501';
  end if;
  select * into ec from public.enrollment_codes
   where code = upper(btrim(_code)) for update;
  if found and exists (select 1 from public.course_members
                       where course_id = ec.course_id and user_id = (select auth.uid())) then
    return ec.course_id; -- already enrolled: idempotent, consumes nothing
  end if;
  if not found or not ec.is_active
     or (ec.expires_at is not null and ec.expires_at < now())
     or (ec.max_uses is not null and ec.uses >= ec.max_uses) then
    raise exception 'CQ_INVALID_CODE' using errcode = 'check_violation';
  end if;
  select status into course_status from public.courses where id = ec.course_id;
  if course_status = 'archived' then
    raise exception 'CQ_COURSE_ARCHIVED' using errcode = 'check_violation';
  end if;

  insert into public.course_members (course_id, user_id, member_role)
  values (ec.course_id, (select auth.uid()), 'student')
  on conflict (course_id, user_id) do nothing;
  if found then
    update public.enrollment_codes set uses = uses + 1 where id = ec.id;
  end if;
  return ec.course_id;
end $$;

-- ---------------------------------------------------------------- clone course (content only, no student data)
create function public.clone_course(_source_id uuid, _term smallint, _academic_year smallint,
  _classroom text default '')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  src public.courses;
  v_course uuid;
begin
  if not private.is_course_teacher(_source_id) then
    raise exception 'CQ_FORBIDDEN' using errcode = '42501';
  end if;
  select * into src from public.courses where id = _source_id;

  insert into public.courses (code, name, level, classroom, term, academic_year, description,
    learning_outcomes, cover_path, status, weeks, settings, source_course_id, created_by)
  values (src.code, src.name, src.level, coalesce(_classroom, ''), _term, _academic_year, src.description,
    src.learning_outcomes, src.cover_path, 'draft', src.weeks, src.settings, src.id, (select auth.uid()))
  returning id into v_course;

  create temporary table unit_map (old_ref uuid, new_ref uuid) on commit drop;
  create temporary table lesson_map (old_ref uuid, new_ref uuid) on commit drop;

  with src_units as (
    select u.*, gen_random_uuid() as nid from public.learning_units u where u.course_id = _source_id
  ), ins as (
    insert into public.learning_units (id, course_id, position, week_no, title, description, published)
    select nid, v_course, position, week_no, title, description, published from src_units
    returning id
  )
  insert into unit_map select id, nid from src_units;

  with src_lessons as (
    select l.*, gen_random_uuid() as nid from public.lessons l where l.course_id = _source_id
  ), ins as (
    insert into public.lessons (id, unit_id, course_id, position, title, body_md, quest_stage,
      estimated_minutes, published)
    select s.nid, m.new_ref, v_course, s.position, s.title, s.body_md, s.quest_stage, s.estimated_minutes, s.published
    from src_lessons s join unit_map m on m.old_ref = s.unit_id
    returning id
  )
  insert into lesson_map select id, nid from src_lessons;

  update public.lessons l set prerequisite_lesson_id = mp.new_ref
    from public.lessons o
    join lesson_map ml on ml.old_ref = o.id
    join lesson_map mp on mp.old_ref = o.prerequisite_lesson_id
   where l.id = ml.new_ref;

  insert into public.lesson_resources (lesson_id, course_id, position, type, title, url, storage_path, content, meta)
  select m.new_ref, v_course, r.position, r.type, r.title, r.url, r.storage_path, r.content, r.meta
  from public.lesson_resources r join lesson_map m on m.old_ref = r.lesson_id;

  perform private.write_audit('course.cloned', 'courses', v_course,
    jsonb_build_object('source_course_id', _source_id), null);
  return v_course;
end $$;

revoke all on function public.create_enrollment_code(uuid, timestamptz, integer) from public, anon;
revoke all on function public.join_course_by_code(text) from public, anon;
revoke all on function public.clone_course(uuid, smallint, smallint, text) from public, anon;
grant execute on function public.create_enrollment_code(uuid, timestamptz, integer) to authenticated;
grant execute on function public.join_course_by_code(text) to authenticated;
grant execute on function public.clone_course(uuid, smallint, smallint, text) to authenticated;

-- enrollment codes are only created via RPC (server-generated); teachers may still deactivate
revoke insert on public.enrollment_codes from authenticated;

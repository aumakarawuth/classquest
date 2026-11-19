-- P3-01: level definitions (global defaults + per-course override), progress RPC, XP for lessons.

create table public.level_definitions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses (id) on delete cascade, -- null = global default
  level smallint not null check (level between 1 and 100),
  xp_threshold integer not null check (xp_threshold >= 0),
  title text not null default '' check (char_length(title) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index level_definitions_scope_level on public.level_definitions (coalesce(course_id, '00000000-0000-0000-0000-000000000000'::uuid), level);
create trigger level_definitions_updated_at before update on public.level_definitions
  for each row execute function private.set_updated_at();

-- default ladder (configuration, not learner data)
insert into public.level_definitions (course_id, level, xp_threshold, title) values
  (null, 1, 0, 'Rookie'), (null, 2, 100, 'Explorer'), (null, 3, 250, 'Maker'),
  (null, 4, 450, 'Builder'), (null, 5, 700, 'Engineer'), (null, 6, 1000, 'Innovator'),
  (null, 7, 1400, 'Expert'), (null, 8, 1900, 'Master'), (null, 9, 2500, 'Champion'),
  (null, 10, 3200, 'Legend');

insert into public.system_settings (key, value, description) values
  ('xp.lesson_complete', '10', 'XP เมื่อเรียนบทเรียนจบ (ต่อบทเรียน ครั้งเดียว)')
on conflict (key) do nothing;

alter table public.level_definitions enable row level security;
create policy levels_read on public.level_definitions for select to authenticated using (
  course_id is null or (select private.can_view_course_content(course_id)));
create policy levels_admin_global on public.level_definitions for all to authenticated
  using (course_id is null and (select private.has_role('admin')))
  with check (course_id is null and (select private.has_role('admin')));
create policy levels_teacher_course on public.level_definitions for all to authenticated
  using (course_id is not null and (select private.is_course_teacher(course_id)))
  with check (course_id is not null and (select private.is_course_teacher(course_id)));

-- ---------------------------------------------------------------- helpers
create function private.setting_int(_key text, _default integer) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce((select (value #>> '{}')::integer from public.system_settings where key = _key), _default);
$$;

create function private.award_xp(_user uuid, _course uuid, _amount integer, _source_type text,
  _source_id uuid, _reason text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if _amount is null or _amount = 0 then return false; end if;
  insert into public.xp_transactions (user_id, course_id, amount, source_type, source_id, reason, created_by)
  values (_user, _course, _amount, _source_type, _source_id, _reason, (select auth.uid()))
  on conflict (user_id, source_type, source_id, reason) do nothing;
  return found;
end $$;
revoke all on function private.setting_int(text, integer), private.award_xp(uuid, uuid, integer, text, uuid, text) from public;

-- ---------------------------------------------------------------- my_course_progress
-- XP is always summed from the ledger; the level ladder is the course override if present, else global.
create function public.my_course_progress(_course_id uuid)
returns table (xp integer, level smallint, level_title text, level_floor integer, next_threshold integer)
language sql stable security definer set search_path = '' as $$
  with me as (select (select auth.uid()) as uid),
  total as (
    select coalesce(sum(amount), 0)::integer as xp from public.xp_transactions, me
     where user_id = me.uid and course_id = _course_id
  ),
  ladder as (
    select level, xp_threshold, title from public.level_definitions
     where course_id = _course_id
    union all
    select level, xp_threshold, title from public.level_definitions
     where course_id is null and not exists (select 1 from public.level_definitions where course_id = _course_id)
  ),
  cur as (
    select l.* from ladder l, total t where l.xp_threshold <= t.xp order by l.xp_threshold desc limit 1
  )
  select t.xp, cur.level, cur.title, cur.xp_threshold,
         (select min(xp_threshold) from ladder where xp_threshold > t.xp)
    from total t left join cur on true
   where private.is_course_member(_course_id);
$$;
revoke all on function public.my_course_progress(uuid) from public, anon;
grant execute on function public.my_course_progress(uuid) to authenticated;

-- ---------------------------------------------------------------- save_course_levels (teacher, atomic)
create function public.save_course_levels(_course_id uuid, _levels jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_course_teacher(_course_id) then
    raise exception 'CQ_FORBIDDEN' using errcode = '42501';
  end if;
  if jsonb_typeof(_levels) <> 'array' or jsonb_array_length(_levels) > 50 then
    raise exception 'CQ_INVALID_LEVELS' using errcode = 'check_violation';
  end if;
  delete from public.level_definitions where course_id = _course_id;
  if jsonb_array_length(_levels) = 0 then return; end if; -- back to global defaults
  if (select min((e ->> 'xp_threshold')::integer) from jsonb_array_elements(_levels) e) <> 0
     or exists (select 1 from (
          select (e ->> 'xp_threshold')::integer t,
                 lag((e ->> 'xp_threshold')::integer) over (order by ord) prev
            from jsonb_array_elements(_levels) with ordinality x(e, ord)) s
          where s.prev is not null and s.t <= s.prev) then
    raise exception 'CQ_INVALID_LEVELS: thresholds must start at 0 and increase' using errcode = 'check_violation';
  end if;
  insert into public.level_definitions (course_id, level, xp_threshold, title)
  select _course_id, ord, (e ->> 'xp_threshold')::integer, coalesce(e ->> 'title', '')
    from jsonb_array_elements(_levels) with ordinality x(e, ord);
  perform private.write_audit('course.levels_saved', 'courses', _course_id, null, _levels);
end $$;
revoke all on function public.save_course_levels(uuid, jsonb) from public, anon;
grant execute on function public.save_course_levels(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------- lesson completion awards XP (once per lesson)
create or replace function public.complete_lesson(_lesson_id uuid)
returns public.lesson_progress
language plpgsql security definer set search_path = '' as $$
declare
  prereq uuid;
  row public.lesson_progress;
begin
  if not private.has_role('student') or not private.lesson_visible_to_student(_lesson_id) then
    raise exception 'CQ_FORBIDDEN' using errcode = '42501';
  end if;

  select prerequisite_lesson_id into prereq from public.lessons where id = _lesson_id;
  if prereq is not null and not exists (
       select 1 from public.lesson_progress
        where lesson_id = prereq and user_id = (select auth.uid()) and status = 'completed') then
    raise exception 'CQ_LOCKED: prerequisite lesson not completed' using errcode = 'check_violation';
  end if;

  insert into public.lesson_progress (lesson_id, user_id, status, completed_at)
  values (_lesson_id, (select auth.uid()), 'completed', now())
  on conflict (lesson_id, user_id) do update
     set status = 'completed',
         completed_at = coalesce(public.lesson_progress.completed_at, excluded.completed_at)
  returning * into row;
  perform private.award_xp((select auth.uid()), (select course_id from public.lessons where id = _lesson_id),
    private.setting_int('xp.lesson_complete', 10), 'lesson', _lesson_id, 'lesson_completed');
  return row;
end $$;

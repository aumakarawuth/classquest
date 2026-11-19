-- P3-04: privacy-preserving leaderboard. Off unless the admin enables it system-wide AND the teacher
-- enables it for the course. Only students who opted in appear, by nickname, with level and XP only.

create function private.leaderboard_enabled(_course_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select value = 'true'::jsonb from public.system_settings where key = 'feature.leaderboard'), false)
     and coalesce((select (settings ->> 'leaderboard')::boolean from public.courses where id = _course_id), false);
$$;
revoke all on function private.leaderboard_enabled(uuid) from public;

create function public.get_leaderboard(_course_id uuid)
returns table (rank integer, nickname text, level smallint, xp integer, is_me boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_course_member(_course_id) then
    raise exception 'CQ_FORBIDDEN' using errcode = '42501';
  end if;
  if not private.leaderboard_enabled(_course_id) then
    return; -- disabled: empty result, the UI explains why
  end if;
  return query
  with ladder as (
    select l.level, l.xp_threshold from public.level_definitions l where l.course_id = _course_id
    union all
    select l.level, l.xp_threshold from public.level_definitions l
     where l.course_id is null and not exists (select 1 from public.level_definitions where course_id = _course_id)
  ),
  totals as (
    select m.user_id, coalesce(sum(x.amount), 0)::integer as xp
      from public.course_members m
      join public.profiles p on p.id = m.user_id and p.leaderboard_opt_in and p.status = 'active'
      left join public.xp_transactions x on x.user_id = m.user_id and x.course_id = _course_id
     where m.course_id = _course_id and m.member_role = 'student'
     group by m.user_id
  ),
  ranked as (
    select t.*, (rank() over (order by t.xp desc))::integer as rnk from totals t
  )
  select r.rnk,
         coalesce(nullif(btrim(p.nickname), ''), 'ผู้เล่นนิรนาม'),
         (select max(l.level) from ladder l where l.xp_threshold <= r.xp)::smallint,
         r.xp,
         r.user_id = (select auth.uid())
    from ranked r join public.profiles p on p.id = r.user_id
   where r.rnk <= 20 or r.user_id = (select auth.uid())
   order by r.rnk, p.nickname;
end $$;
revoke all on function public.get_leaderboard(uuid) from public, anon;
grant execute on function public.get_leaderboard(uuid) to authenticated;

create function public.set_course_leaderboard(_course_id uuid, _enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_course_teacher(_course_id) then
    raise exception 'CQ_FORBIDDEN' using errcode = '42501';
  end if;
  update public.courses set settings = settings || jsonb_build_object('leaderboard', _enabled) where id = _course_id;
  perform private.write_audit('course.leaderboard_toggled', 'courses', _course_id, null,
    jsonb_build_object('enabled', _enabled));
end $$;
revoke all on function public.set_course_leaderboard(uuid, boolean) from public, anon;
grant execute on function public.set_course_leaderboard(uuid, boolean) to authenticated;

create function public.leaderboard_status(_course_id uuid)
returns table (system_enabled boolean, course_enabled boolean)
language sql stable security definer set search_path = '' as $$
  select coalesce((select value = 'true'::jsonb from public.system_settings where key = 'feature.leaderboard'), false),
         coalesce((select (settings ->> 'leaderboard')::boolean from public.courses where id = _course_id), false)
   where private.is_course_member(_course_id) or private.has_role('admin');
$$;
revoke all on function public.leaderboard_status(uuid) from public, anon;
grant execute on function public.leaderboard_status(uuid) to authenticated;

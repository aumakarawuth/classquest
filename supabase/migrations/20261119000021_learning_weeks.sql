-- P3-03: non-punitive weekly learning streak. A "learning week" is an ISO week (Asia/Bangkok) with at least
-- one learning action (lesson completed, work submitted, quiz submitted). One missed week is forgiven;
-- nothing is ever deducted.

create function public.my_learning_weeks(_course_id uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  with me as (select (select auth.uid()) uid),
  acts as (
    select (lp.completed_at at time zone 'Asia/Bangkok')::date d
      from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id, me
     where lp.user_id = me.uid and l.course_id = _course_id and lp.completed_at is not null
    union all
    select (s.submitted_at at time zone 'Asia/Bangkok')::date from public.quest_submissions s, me
     where s.user_id = me.uid and s.course_id = _course_id
    union all
    select (a.submitted_at at time zone 'Asia/Bangkok')::date from public.quiz_attempts a, me
     where a.user_id = me.uid and a.course_id = _course_id and a.submitted_at is not null
  ),
  weeks as (select distinct date_trunc('week', d)::date w from acts),
  this_week as (select date_trunc('week', (now() at time zone 'Asia/Bangkok')::date)::date w),
  last8 as (
    select (t.w - (g * 7))::date w, exists (select 1 from weeks where weeks.w = (t.w - g * 7)) active
      from this_week t, generate_series(7, 0, -1) g
  )
  select case when not private.is_course_member(_course_id) then null else jsonb_build_object(
    'total_weeks', (select count(*) from weeks),
    'current_streak', (
      -- walk back from this week (or last week if this one has no activity yet); allow one empty week
      with recursive walk(w, streak, skips) as (
        select t.w, case when exists (select 1 from weeks where weeks.w = t.w) then 1 else 0 end, 0 from this_week t
        union all
        select (walk.w - 7)::date,
               walk.streak + case when exists (select 1 from weeks where weeks.w = walk.w - 7) then 1 else 0 end,
               walk.skips + case when exists (select 1 from weeks where weeks.w = walk.w - 7) then 0 else 1 end
          from walk
         where walk.skips + case when exists (select 1 from weeks where weeks.w = walk.w - 7) then 0 else 1 end <= 1
           and walk.w > (select coalesce(min(w), walk.w) from weeks)
      )
      select coalesce(max(streak), 0) from walk),
    'recent', (select jsonb_agg(jsonb_build_object('week_start', w, 'active', active) order by w) from last8)
  ) end;
$$;
revoke all on function public.my_learning_weeks(uuid) from public, anon;
grant execute on function public.my_learning_weeks(uuid) to authenticated;

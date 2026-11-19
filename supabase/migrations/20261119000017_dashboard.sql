-- P6-01: activity days (for "logged in" / engagement) and a single-request teacher dashboard computed from real data.

create table public.activity_days (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);
alter table public.activity_days enable row level security;
create policy activity_own on public.activity_days for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.activity_days from authenticated;

-- called once per app load; one row per user per Bangkok day (no tracking beyond that)
create function public.touch_activity() returns void
language sql security definer set search_path = '' as $$
  insert into public.activity_days (user_id, day)
  select (select auth.uid()), (now() at time zone 'Asia/Bangkok')::date
   where (select auth.uid()) is not null and private.is_active()
  on conflict do nothing;
$$;
revoke all on function public.touch_activity() from public, anon;
grant execute on function public.touch_activity() to authenticated;

create function public.teacher_dashboard(_course_id uuid, _unit_id uuid default null, _days integer default null)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  since timestamptz := case when _days is null then '-infinity'::timestamptz else now() - make_interval(days => _days) end;
  today date := (now() at time zone 'Asia/Bangkok')::date;
  result jsonb;
begin
  if not private.is_course_teacher(_course_id) then
    raise exception 'CQ_FORBIDDEN' using errcode = '42501';
  end if;

  with students as (
    select m.user_id, p.display_name, p.student_code
      from public.course_members m join public.profiles p on p.id = m.user_id
     where m.course_id = _course_id and m.member_role = 'student'
  ),
  lessons as (
    select l.id from public.lessons l join public.learning_units u on u.id = l.unit_id
     where l.course_id = _course_id and l.published and u.published and (_unit_id is null or l.unit_id = _unit_id)
  ),
  quests as (
    select q.id, q.max_score from public.quests q
     where q.course_id = _course_id and q.published and (_unit_id is null or q.unit_id = _unit_id)
  ),
  per_student as (
    select s.user_id, s.display_name, s.student_code,
      (select max(day) from public.activity_days a where a.user_id = s.user_id) as last_active,
      (select count(*) from public.activity_days a where a.user_id = s.user_id and a.day > today - 7) as active_days_7,
      (select count(*) from public.lesson_progress lp where lp.user_id = s.user_id and lp.status = 'completed'
          and lp.lesson_id in (select id from lessons) and lp.completed_at >= since) as lessons_done,
      (select count(distinct qs.quest_id) from public.quest_submissions qs where qs.user_id = s.user_id and qs.status = 'approved'
          and qs.quest_id in (select id from quests) and qs.submitted_at >= since) as quests_approved,
      (select count(*) from public.quest_submissions qs where qs.user_id = s.user_id and qs.status = 'needs_revision'
          and qs.quest_id in (select id from quests)
          and not exists (select 1 from public.quest_submissions n where n.quest_id = qs.quest_id and n.user_id = qs.user_id
                           and n.attempt_no > qs.attempt_no)) as needs_revision,
      (select round(avg(r.score / nullif(q.max_score, 0) * 100), 1) from public.quest_submissions qs
          join public.quest_reviews r on r.submission_id = qs.id join quests q on q.id = qs.quest_id
         where qs.user_id = s.user_id and r.score is not null) as avg_quest_pct,
      (select round(avg(a.score / nullif(a.max_score, 0) * 100), 1) from public.quiz_attempts a
         where a.user_id = s.user_id and a.course_id = _course_id and a.status = 'graded' and a.submitted_at >= since) as avg_quiz_pct,
      (select coalesce(sum(x.amount), 0) from public.xp_transactions x where x.user_id = s.user_id and x.course_id = _course_id) as xp,
      (select count(*) from public.competency_matrix(_course_id, s.user_id) c where c.passed = false) as competencies_developing
    from students s
  ),
  totals as (
    select (select count(*) from students) n_students,
           (select count(*) from lessons) n_lessons,
           (select count(*) from quests) n_quests
  ),
  flagged as (
    select ps.*,
      array_remove(array[
        case when ps.last_active is null or ps.last_active <= today - 7 then 'inactive_7d' end,
        case when t.n_lessons > 0 and ps.lessons_done::numeric / t.n_lessons <
               0.5 * (select coalesce(percentile_cont(0.5) within group (order by p2.lessons_done), 0) from per_student p2) / nullif(t.n_lessons, 0)
             then 'behind_lessons' end,
        case when ps.needs_revision > 0 then 'needs_revision' end,
        case when ps.avg_quiz_pct is not null and ps.avg_quiz_pct < 50 then 'low_quiz' end,
        case when ps.competencies_developing > 0 then 'competency_developing' end
      ], null) as flags
    from per_student ps, totals t
  ),
  prepost as (
    select z.kind, round(avg(f.pct), 1) as mean_pct, count(*) as n
      from (select distinct on (a.quiz_id, a.user_id) a.quiz_id, a.user_id, a.score / nullif(a.max_score, 0) * 100 as pct
              from public.quiz_attempts a where a.course_id = _course_id and a.status = 'graded'
             order by a.quiz_id, a.user_id, a.attempt_no) f
      join public.quizzes z on z.id = f.quiz_id and z.kind in ('pretest', 'posttest')
     group by z.kind
  ),
  comp as (
    select count(*) filter (where passed) as passed, count(*) filter (where passed is not null) as assessed, count(*) as cells
      from public.competency_matrix(_course_id)
  )
  select jsonb_build_object(
    'students_total', t.n_students,
    'active_7d', (select count(*) from per_student where active_days_7 > 0),
    'lessons_total', t.n_lessons,
    'quests_total', t.n_quests,
    'lesson_completion_rate', case when t.n_students * t.n_lessons > 0
        then round((select sum(lessons_done) from per_student)::numeric / (t.n_students * t.n_lessons) * 100, 1) end,
    'quest_completion_rate', case when t.n_students * t.n_quests > 0
        then round((select sum(quests_approved) from per_student)::numeric / (t.n_students * t.n_quests) * 100, 1) end,
    'pending_reviews', (select count(*) from public.quest_submissions s where s.course_id = _course_id and s.status = 'submitted'),
    'avg_quest_pct', (select round(avg(avg_quest_pct), 1) from per_student),
    'avg_quiz_pct', (select round(avg(avg_quiz_pct), 1) from per_student),
    'pretest_mean', (select mean_pct from prepost where kind = 'pretest'),
    'posttest_mean', (select mean_pct from prepost where kind = 'posttest'),
    'competency_pass_rate', (select case when assessed > 0 then round(passed::numeric / assessed * 100, 1) end from comp),
    'competency_assessed_rate', (select case when cells > 0 then round(assessed::numeric / cells * 100, 1) end from comp),
    'students', coalesce((select jsonb_agg(jsonb_build_object(
        'user_id', f.user_id, 'display_name', f.display_name, 'student_code', f.student_code, 'last_active', f.last_active,
        'lessons_done', f.lessons_done, 'quests_approved', f.quests_approved, 'needs_revision', f.needs_revision,
        'avg_quest_pct', f.avg_quest_pct, 'avg_quiz_pct', f.avg_quiz_pct, 'xp', f.xp,
        'competencies_developing', f.competencies_developing, 'flags', to_jsonb(f.flags))
        order by cardinality(f.flags) desc, f.display_name) from flagged f), '[]'::jsonb)
  ) into result
  from totals t;
  return result;
end $$;
revoke all on function public.teacher_dashboard(uuid, uuid, integer) from public, anon;
grant execute on function public.teacher_dashboard(uuid, uuid, integer) to authenticated;

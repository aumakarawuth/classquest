-- P4-03: pre/post-test comparison from real attempts, with stable anonymous codes for publishable reports.

create table public.anonymous_codes (
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  code text not null check (code ~ '^S[0-9]{2,4}$'),
  created_at timestamptz not null default now(),
  primary key (course_id, user_id),
  unique (course_id, code)
);
alter table public.anonymous_codes enable row level security;
create policy anon_codes_teacher on public.anonymous_codes for select to authenticated
  using ((select private.is_course_teacher(course_id)));
revoke insert, update, delete on public.anonymous_codes from authenticated;

-- assigns S01, S02, ... to students without a code (stable once assigned; order is random, not alphabetical)
create function private.ensure_anonymous_codes(_course_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  next_n integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('anon' || _course_id::text, 0));
  select coalesce(max(substr(code, 2)::integer), 0) into next_n from public.anonymous_codes where course_id = _course_id;
  insert into public.anonymous_codes (course_id, user_id, code)
  select _course_id, m.user_id, 'S' || lpad((next_n + row_number() over (order by random()))::text, 2, '0')
    from public.course_members m
   where m.course_id = _course_id and m.member_role = 'student'
     and not exists (select 1 from public.anonymous_codes a where a.course_id = _course_id and a.user_id = m.user_id);
end $$;
revoke all on function private.ensure_anonymous_codes(uuid) from public;

-- First graded attempt of each quiz per student (standard for pre/post designs).
create function public.prepost_report(_course_id uuid, _pre_quiz_id uuid, _post_quiz_id uuid, _anonymized boolean default true)
returns table (student text, pre_percent numeric, post_percent numeric, gain numeric, normalized_gain numeric)
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_course_teacher(_course_id)
     or not exists (select 1 from public.quizzes where id = _pre_quiz_id and course_id = _course_id)
     or not exists (select 1 from public.quizzes where id = _post_quiz_id and course_id = _course_id) then
    raise exception 'CQ_FORBIDDEN' using errcode = '42501';
  end if;
  if _anonymized then perform private.ensure_anonymous_codes(_course_id); end if;

  return query
  with firsts as (
    select distinct on (a.quiz_id, a.user_id) a.quiz_id, a.user_id,
           case when a.max_score > 0 then round(a.score / a.max_score * 100, 2) end as pct
      from public.quiz_attempts a
     where a.quiz_id in (_pre_quiz_id, _post_quiz_id) and a.status = 'graded'
     order by a.quiz_id, a.user_id, a.attempt_no
  )
  select case when _anonymized then ac.code else p.display_name end,
         pre.pct, post.pct,
         case when pre.pct is not null and post.pct is not null then post.pct - pre.pct end,
         case when pre.pct is not null and post.pct is not null and pre.pct < 100
              then round((post.pct - pre.pct) / (100 - pre.pct), 3) end
    from public.course_members m
    join public.profiles p on p.id = m.user_id
    left join public.anonymous_codes ac on ac.course_id = _course_id and ac.user_id = m.user_id
    left join firsts pre on pre.quiz_id = _pre_quiz_id and pre.user_id = m.user_id
    left join firsts post on post.quiz_id = _post_quiz_id and post.user_id = m.user_id
   where m.course_id = _course_id and m.member_role = 'student'
   order by case when _anonymized then ac.code else p.display_name end;
end $$;
revoke all on function public.prepost_report(uuid, uuid, uuid, boolean) from public, anon;
grant execute on function public.prepost_report(uuid, uuid, uuid, boolean) to authenticated;

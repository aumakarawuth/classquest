-- P4-04: competency framework, mapping, evidence-based results, skill matrix.

create table public.competencies (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  parent_id uuid references public.competencies (id) on delete set null, -- skill-tree structure
  code text not null check (char_length(code) between 1 and 20),
  name text not null check (char_length(name) between 1 and 200),
  description text not null default '' check (char_length(description) <= 2000),
  pass_threshold numeric(5, 2) not null default 60 check (pass_threshold between 0 and 100),
  position integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, code),
  check (parent_id is distinct from id)
);
create index competencies_course_idx on public.competencies (course_id, position);
create trigger competencies_updated_at before update on public.competencies
  for each row execute function private.set_updated_at();

create function private.competency_parent_same_course() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.parent_id is not null and not exists (
       select 1 from public.competencies where id = new.parent_id and course_id = new.course_id) then
    raise exception 'CQ_PARENT_COURSE_MISMATCH' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger competencies_parent_check before insert or update of parent_id on public.competencies
  for each row execute function private.competency_parent_same_course();

alter table public.rubric_criteria add column competency_id uuid references public.competencies (id) on delete set null;

create table public.competency_mappings (
  id uuid primary key default gen_random_uuid(),
  competency_id uuid not null references public.competencies (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  target_type text not null check (target_type in ('quest', 'lesson', 'quiz', 'lab')),
  target_id uuid not null,
  weight numeric(5, 2) not null default 1 check (weight > 0),
  created_at timestamptz not null default now(),
  unique (competency_id, target_type, target_id)
);
create index competency_mappings_target_idx on public.competency_mappings (target_type, target_id);

-- one row per (competency, student, evidence); the latest evidence decides the status
create table public.competency_results (
  id uuid primary key default gen_random_uuid(),
  competency_id uuid not null references public.competencies (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  score_percent numeric(5, 2) not null check (score_percent between 0 and 100),
  source_type text not null check (source_type in ('rubric', 'quest', 'quiz', 'manual')),
  source_id uuid not null,
  assessed_by uuid references public.profiles (id) on delete set null,
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competency_id, user_id, source_type, source_id)
);
create index competency_results_lookup_idx on public.competency_results (course_id, user_id, competency_id, created_at desc);
create trigger competency_results_updated_at before update on public.competency_results
  for each row execute function private.set_updated_at();

alter table public.competencies enable row level security;
alter table public.competency_mappings enable row level security;
alter table public.competency_results enable row level security;

create policy competencies_read on public.competencies for select to authenticated
  using ((select private.can_view_course_content(course_id)));
create policy competencies_teacher_write on public.competencies for all to authenticated
  using ((select private.is_course_teacher(course_id))) with check ((select private.is_course_teacher(course_id)));
create policy mappings_read on public.competency_mappings for select to authenticated
  using ((select private.can_view_course_content(course_id)));
create policy mappings_teacher_write on public.competency_mappings for all to authenticated
  using ((select private.is_course_teacher(course_id)))
  with check ((select private.is_course_teacher(course_id))
              and exists (select 1 from public.competencies k where k.id = competency_id and k.course_id = competency_mappings.course_id));
create policy competency_results_read on public.competency_results for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_course_teacher(course_id)));
revoke insert, update, delete on public.competency_results from authenticated;

-- ---------------------------------------------------------------- evidence → results (triggers)
create function private.record_competency(_competency uuid, _course uuid, _user uuid, _percent numeric,
  _source_type text, _source_id uuid, _by uuid, _note text) returns void
language sql security definer set search_path = '' as $$
  -- clock_timestamp(): several pieces of evidence can be recorded in one transaction; order must still be exact
  insert into public.competency_results (competency_id, course_id, user_id, score_percent, source_type, source_id, assessed_by, note, created_at)
  values (_competency, _course, _user, least(100, greatest(0, round(_percent, 2))), _source_type, _source_id, _by, coalesce(_note, ''), clock_timestamp())
  on conflict (competency_id, user_id, source_type, source_id)
  do update set score_percent = excluded.score_percent, assessed_by = excluded.assessed_by, note = excluded.note, created_at = clock_timestamp();
$$;

-- rubric criterion linked to a competency → evidence per criterion
create function private.on_rubric_result() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  c public.rubric_criteria;
  r public.quest_reviews;
  s public.quest_submissions;
begin
  select * into c from public.rubric_criteria where id = new.criterion_id;
  if c.competency_id is null then return null; end if;
  select * into r from public.quest_reviews where id = new.review_id;
  select * into s from public.quest_submissions where id = r.submission_id;
  perform private.record_competency(c.competency_id, s.course_id, s.user_id, new.points / c.max_points * 100,
    'rubric', r.id, r.reviewer_id, '');
  return null;
end $$;
create trigger rubric_results_competency after insert on public.rubric_results
  for each row execute function private.on_rubric_result();

-- quest mapped to competencies (not covered by rubric criteria) → evidence from the overall score
create function private.on_quest_review() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  s public.quest_submissions;
  q public.quests;
begin
  if new.score is null then return null; end if;
  select * into s from public.quest_submissions where id = new.submission_id;
  select * into q from public.quests where id = s.quest_id;
  if q.max_score <= 0 then return null; end if;
  perform private.record_competency(m.competency_id, s.course_id, s.user_id, new.score / q.max_score * 100,
    'quest', new.id, new.reviewer_id, '')
    from public.competency_mappings m
   where m.target_type = 'quest' and m.target_id = q.id
     and not exists (select 1 from public.rubric_criteria rc
                      where rc.rubric_id = q.rubric_id and rc.competency_id = m.competency_id);
  return null;
end $$;
create trigger quest_reviews_competency after insert on public.quest_reviews
  for each row execute function private.on_quest_review();

revoke all on function private.record_competency(uuid, uuid, uuid, numeric, text, uuid, uuid, text) from public;

-- ---------------------------------------------------------------- manual assessment (practical / observation)
create function public.record_competency_result(_competency_id uuid, _user_id uuid, _score_percent numeric, _note text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  k public.competencies;
begin
  select * into k from public.competencies where id = _competency_id;
  if not found or not private.is_course_teacher(k.course_id)
     or not exists (select 1 from public.course_members where course_id = k.course_id and user_id = _user_id and member_role = 'student') then
    raise exception 'CQ_FORBIDDEN' using errcode = '42501';
  end if;
  if _score_percent is null or _score_percent < 0 or _score_percent > 100 then
    raise exception 'CQ_SCORE_OUT_OF_RANGE' using errcode = 'check_violation';
  end if;
  perform private.record_competency(k.id, k.course_id, _user_id, _score_percent, 'manual', gen_random_uuid(),
    (select auth.uid()), _note);
  perform private.write_audit('competency.assessed', 'competency_results', _user_id, null,
    jsonb_build_object('competency_id', k.id, 'score_percent', _score_percent));
end $$;
revoke all on function public.record_competency_result(uuid, uuid, numeric, text) from public, anon;
grant execute on function public.record_competency_result(uuid, uuid, numeric, text) to authenticated;

-- ---------------------------------------------------------------- matrix: latest evidence per (student, competency)
create function public.competency_matrix(_course_id uuid, _user_id uuid default null)
returns table (user_id uuid, display_name text, competency_id uuid, score_percent numeric,
               passed boolean, evidence_count integer, last_assessed_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with allowed as (
    select private.is_course_teacher(_course_id) as teacher,
           (select auth.uid()) as me
  ),
  students as (
    select m.user_id, p.display_name
      from public.course_members m join public.profiles p on p.id = m.user_id, allowed a
     where m.course_id = _course_id and m.member_role = 'student'
       and (a.teacher or m.user_id = a.me)
       and (_user_id is null or m.user_id = _user_id)
  ),
  latest as (
    select distinct on (r.user_id, r.competency_id) r.user_id, r.competency_id, r.score_percent, r.created_at
      from public.competency_results r
     where r.course_id = _course_id
     order by r.user_id, r.competency_id, r.created_at desc
  ),
  counts as (
    select r.user_id, r.competency_id, count(*)::integer n
      from public.competency_results r where r.course_id = _course_id group by 1, 2
  )
  select s.user_id, s.display_name, k.id, l.score_percent,
         case when l.score_percent is null then null else l.score_percent >= k.pass_threshold end,
         coalesce(c.n, 0), l.created_at
    from students s
    cross join public.competencies k
    left join latest l on l.user_id = s.user_id and l.competency_id = k.id
    left join counts c on c.user_id = s.user_id and c.competency_id = k.id
   where k.course_id = _course_id
   order by s.display_name, k.position, k.code;
$$;
revoke all on function public.competency_matrix(uuid, uuid) from public, anon;
grant execute on function public.competency_matrix(uuid, uuid) to authenticated;

create or replace function public.save_quest_rubric(_quest_id uuid, _criteria jsonb)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  q public.quests;
  rid uuid;
begin
  select * into q from public.quests where id = _quest_id;
  if not found or not private.is_course_teacher(q.course_id) then
    raise exception 'CQ_FORBIDDEN' using errcode = '42501';
  end if;
  if jsonb_typeof(_criteria) <> 'array' or jsonb_array_length(_criteria) > 20 then
    raise exception 'CQ_INVALID_RUBRIC' using errcode = 'check_violation';
  end if;

  if jsonb_array_length(_criteria) = 0 then
    update public.quests set rubric_id = null where id = _quest_id;
    return null;
  end if;

  rid := q.rubric_id;
  if rid is not null and exists (
       select 1 from public.rubric_results rr join public.rubric_criteria c on c.id = rr.criterion_id
        where c.rubric_id = rid) then
    rid := null; -- rubric already used for grading: keep it intact, create a new version
  end if;
  if rid is null then
    insert into public.rubrics (course_id, title) values (q.course_id, q.title) returning id into rid;
    update public.quests set rubric_id = rid where id = _quest_id;
  else
    delete from public.rubric_criteria where rubric_id = rid;
  end if;

  if exists (select 1 from jsonb_array_elements(_criteria) c
              where nullif(c ->> 'competency_id', '') is not null
                and not exists (select 1 from public.competencies k
                                 where k.id = (c ->> 'competency_id')::uuid and k.course_id = q.course_id)) then
    raise exception 'CQ_INVALID_RUBRIC: competency not in course' using errcode = 'check_violation';
  end if;
  insert into public.rubric_criteria (rubric_id, position, name, description, max_points, competency_id)
  select rid, ord, btrim(c ->> 'name'), coalesce(c ->> 'description', ''), (c ->> 'max_points')::numeric,
         nullif(c ->> 'competency_id', '')::uuid
  from jsonb_array_elements(_criteria) with ordinality as t(c, ord);
  return rid;
end $$;

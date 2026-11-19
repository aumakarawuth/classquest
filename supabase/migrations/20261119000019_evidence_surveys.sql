-- P6-03: Competition Evidence Center + satisfaction surveys (Likert). Teacher-only evidence; anonymous surveys
-- expose aggregates only.

create type public.evidence_category as enum (
  'problem_needs',        -- ข้อมูลปัญหาและความต้องการของผู้เรียน
  'objectives',           -- วัตถุประสงค์ของนวัตกรรม
  'lesson_plan',          -- แผนการจัดการเรียนรู้
  'teaching_media',       -- สื่อการเรียนการสอน
  'activity_evidence',    -- หลักฐานกิจกรรม
  'prepost_results',      -- ผลการประเมินก่อนและหลังเรียน
  'competency_results',   -- ผลการประเมินสมรรถนะ
  'student_work',         -- ตัวอย่างชิ้นงานนักเรียน
  'satisfaction',         -- แบบประเมินความพึงพอใจ
  'student_reflection',   -- การสะท้อนผลของผู้เรียน
  'teacher_reflection',   -- การสะท้อนผลของครู
  'improvement_history',  -- ประวัติการปรับปรุงนวัตกรรม
  'trial_report'          -- รายงานผลการทดลองใช้
);

create table public.competition_evidence (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  category public.evidence_category not null,
  title text not null check (char_length(title) between 1 and 200),
  body_md text not null default '' check (char_length(body_md) <= 50000),
  url text check (url ~ '^https://' and char_length(url) <= 2000),
  occurred_on date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index competition_evidence_course_idx on public.competition_evidence (course_id, category);
create trigger competition_evidence_updated_at before update on public.competition_evidence
  for each row execute function private.set_updated_at();
alter table public.competition_evidence enable row level security;
create policy evidence_teacher on public.competition_evidence for all to authenticated
  using ((select private.is_course_teacher(course_id)) or (select private.has_role('admin')))
  with check ((select private.is_course_teacher(course_id)));

-- ---------------------------------------------------------------- surveys
create table public.surveys (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 2000),
  -- [{"id":"q1","text":"...","type":"likert"|"text"}]; likert = 1..5
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 50),
  anonymous boolean not null default true,
  open boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger surveys_updated_at before update on public.surveys
  for each row execute function private.set_updated_at();

create table public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade, -- dedupe only; never exposed for anonymous surveys
  answers jsonb not null,
  created_at timestamptz not null default now(),
  unique (survey_id, user_id)
);

alter table public.surveys enable row level security;
alter table public.survey_responses enable row level security;
create policy surveys_read on public.surveys for select to authenticated using (
  (select private.is_course_teacher(course_id)) or (open and (select private.can_view_course_content(course_id))));
create policy surveys_teacher_write on public.surveys for all to authenticated
  using ((select private.is_course_teacher(course_id))) with check ((select private.is_course_teacher(course_id)));
-- students see whether they responded (own row); teachers see raw rows only for NON-anonymous surveys
create policy responses_own on public.survey_responses for select to authenticated using (user_id = (select auth.uid()));
create policy responses_teacher_named on public.survey_responses for select to authenticated using (
  exists (select 1 from public.surveys s where s.id = survey_id and not s.anonymous and (select private.is_course_teacher(s.course_id))));
revoke insert, update, delete on public.survey_responses from authenticated;

create function public.submit_survey(_survey_id uuid, _answers jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.surveys;
begin
  select * into s from public.surveys where id = _survey_id;
  if not found or not s.open or not private.has_role('student') or not private.can_view_course_content(s.course_id) then
    raise exception 'CQ_FORBIDDEN' using errcode = '42501';
  end if;
  -- likert answers must be integers 1..5 for known likert items; text answers ≤ 2000 chars
  if jsonb_typeof(_answers) <> 'object' or exists (
       select 1 from jsonb_each(_answers) a
        left join jsonb_array_elements(s.items) i on i ->> 'id' = a.key
        where i is null
           or (i ->> 'type' = 'likert' and (jsonb_typeof(a.value) <> 'number' or (a.value)::text::numeric not in (1, 2, 3, 4, 5)))
           or (i ->> 'type' = 'text' and (jsonb_typeof(a.value) <> 'string' or char_length(a.value #>> '{}') > 2000))) then
    raise exception 'CQ_INVALID_ANSWERS' using errcode = 'check_violation';
  end if;
  insert into public.survey_responses (survey_id, user_id, answers) values (_survey_id, (select auth.uid()), _answers)
  on conflict (survey_id, user_id) do update set answers = excluded.answers, created_at = now();
end $$;

-- aggregates only (mean, SD, n, distribution); text answers returned without identity
create function public.survey_summary(_survey_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.surveys;
begin
  select * into s from public.surveys where id = _survey_id;
  if not found or not private.is_course_teacher(s.course_id) then
    raise exception 'CQ_FORBIDDEN' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'survey_id', s.id, 'title', s.title,
    'respondents', (select count(*) from public.survey_responses where survey_id = s.id),
    'enrolled', (select count(*) from public.course_members where course_id = s.course_id and member_role = 'student'),
    'items', (select jsonb_agg(
      case when i ->> 'type' = 'likert' then jsonb_build_object(
        'id', i ->> 'id', 'text', i ->> 'text', 'type', 'likert',
        'n', (select count(*) from public.survey_responses r where r.survey_id = s.id and r.answers ? (i ->> 'id')),
        'mean', (select round(avg((r.answers ->> (i ->> 'id'))::numeric), 2) from public.survey_responses r where r.survey_id = s.id and r.answers ? (i ->> 'id')),
        'sd', (select round(stddev_samp((r.answers ->> (i ->> 'id'))::numeric), 2) from public.survey_responses r where r.survey_id = s.id and r.answers ? (i ->> 'id')),
        'distribution', (select jsonb_object_agg(v, c) from (
            select g.v::text v, (select count(*) from public.survey_responses r where r.survey_id = s.id and (r.answers ->> (i ->> 'id'))::int = g.v) c
              from generate_series(1, 5) g(v)) d))
      else jsonb_build_object('id', i ->> 'id', 'text', i ->> 'text', 'type', 'text',
        'answers', coalesce((select jsonb_agg(r.answers ->> (i ->> 'id') order by random())
                                from public.survey_responses r
                               where r.survey_id = s.id and coalesce(btrim(r.answers ->> (i ->> 'id')), '') <> ''), '[]'::jsonb))
      end order by ord) from jsonb_array_elements(s.items) with ordinality t(i, ord)));
end $$;

-- per-competency pass counts (no names) for publishable reports
create function public.competency_summary(_course_id uuid) returns table (code text, name text, assessed integer, passed integer, students integer)
language sql stable security definer set search_path = '' as $$
  select k.code, k.name,
         count(*) filter (where m.passed is not null)::integer,
         count(*) filter (where m.passed)::integer,
         count(*)::integer
    from public.competency_matrix(_course_id) m join public.competencies k on k.id = m.competency_id
   where private.is_course_teacher(_course_id)
   group by k.code, k.name, k.position order by k.position, k.code;
$$;

revoke all on function public.submit_survey(uuid, jsonb), public.survey_summary(uuid), public.competency_summary(uuid) from public, anon;
grant execute on function public.submit_survey(uuid, jsonb), public.survey_summary(uuid), public.competency_summary(uuid) to authenticated;

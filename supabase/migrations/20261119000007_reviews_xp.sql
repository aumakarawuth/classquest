-- P2-07: rubrics, teacher review, XP ledger (append-only, idempotent), clone_course copies quests.

-- ---------------------------------------------------------------- rubrics
create table public.rubrics (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rubrics_course_idx on public.rubrics (course_id);
create trigger rubrics_updated_at before update on public.rubrics
  for each row execute function private.set_updated_at();

create table public.rubric_criteria (
  id uuid primary key default gen_random_uuid(),
  rubric_id uuid not null references public.rubrics (id) on delete cascade,
  position smallint not null check (position >= 1),
  name text not null check (char_length(name) between 1 and 200),
  description text not null default '' check (char_length(description) <= 2000),
  max_points numeric(6, 2) not null check (max_points > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rubric_id, position)
);
create trigger rubric_criteria_updated_at before update on public.rubric_criteria
  for each row execute function private.set_updated_at();

alter table public.quests add column rubric_id uuid references public.rubrics (id) on delete set null;

-- ---------------------------------------------------------------- reviews
create type public.review_decision as enum ('approved', 'needs_revision');

create table public.quest_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.quest_submissions (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  reviewer_id uuid references public.profiles (id) on delete set null,
  decision public.review_decision not null,
  score numeric(6, 2) check (score >= 0),
  feedback text not null default '' check (char_length(feedback) <= 5000),
  idempotency_key text not null unique check (char_length(idempotency_key) between 8 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quest_reviews_course_idx on public.quest_reviews (course_id);
create trigger quest_reviews_updated_at before update on public.quest_reviews
  for each row execute function private.set_updated_at();

create table public.rubric_results (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.quest_reviews (id) on delete cascade,
  criterion_id uuid not null references public.rubric_criteria (id) on delete restrict,
  points numeric(6, 2) not null check (points >= 0),
  created_at timestamptz not null default now(),
  unique (review_id, criterion_id)
);

-- ---------------------------------------------------------------- XP ledger
create table public.xp_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  amount integer not null check (amount <> 0),
  source_type text not null check (source_type in ('quest', 'lesson', 'quiz', 'badge', 'manual')),
  source_id uuid not null,
  reason text not null check (char_length(reason) between 1 and 200),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, source_type, source_id, reason)
);
create index xp_transactions_user_course_idx on public.xp_transactions (user_id, course_id);

-- ---------------------------------------------------------------- RLS
alter table public.rubrics enable row level security;
alter table public.rubric_criteria enable row level security;
alter table public.quest_reviews enable row level security;
alter table public.rubric_results enable row level security;
alter table public.xp_transactions enable row level security;

create policy rubrics_read on public.rubrics for select to authenticated
  using ((select private.can_view_course_content(course_id)));
create policy rubrics_teacher_write on public.rubrics for all to authenticated
  using ((select private.is_course_teacher(course_id))) with check ((select private.is_course_teacher(course_id)));
create policy rubric_criteria_read on public.rubric_criteria for select to authenticated
  using (exists (select 1 from public.rubrics r where r.id = rubric_id));
revoke insert, update, delete on public.rubric_criteria from authenticated; -- via save_quest_rubric()

create policy reviews_read on public.quest_reviews for select to authenticated using (
  (select private.is_course_teacher(course_id))
  or exists (select 1 from public.quest_submissions s where s.id = submission_id and s.user_id = (select auth.uid())));
revoke insert, update, delete on public.quest_reviews from authenticated;

create policy rubric_results_read on public.rubric_results for select to authenticated
  using (exists (select 1 from public.quest_reviews r where r.id = review_id));
revoke insert, update, delete on public.rubric_results from authenticated;

create policy xp_read on public.xp_transactions for select to authenticated using (
  user_id = (select auth.uid()) or (select private.is_course_teacher(course_id)));
revoke insert, update, delete on public.xp_transactions from authenticated;

-- ---------------------------------------------------------------- save_quest_rubric
create function public.save_quest_rubric(_quest_id uuid, _criteria jsonb)
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

  insert into public.rubric_criteria (rubric_id, position, name, description, max_points)
  select rid, ord, btrim(c ->> 'name'), coalesce(c ->> 'description', ''), (c ->> 'max_points')::numeric
  from jsonb_array_elements(_criteria) with ordinality as t(c, ord);
  return rid;
end $$;

-- ---------------------------------------------------------------- review_submission
create function public.review_submission(_submission_id uuid, _decision public.review_decision,
  _score numeric, _feedback text, _rubric jsonb, _idempotency_key text)
returns public.quest_reviews
language plpgsql security definer set search_path = '' as $$
declare
  s public.quest_submissions;
  q public.quests;
  existing public.quest_reviews;
  review public.quest_reviews;
  total numeric;
begin
  select * into existing from public.quest_reviews where idempotency_key = _idempotency_key;
  if found then
    if existing.submission_id <> _submission_id then
      raise exception 'CQ_IDEMPOTENCY_KEY_REUSED' using errcode = 'check_violation';
    end if;
    return existing; -- retried request: no second review, no second XP
  end if;

  select * into s from public.quest_submissions where id = _submission_id for update;
  if not found or not private.is_course_teacher(s.course_id) then
    raise exception 'CQ_FORBIDDEN' using errcode = '42501';
  end if;
  if s.status <> 'submitted' or exists (select 1 from public.quest_reviews where submission_id = s.id) then
    raise exception 'CQ_ALREADY_REVIEWED' using errcode = 'check_violation';
  end if;
  select * into q from public.quests where id = s.quest_id;

  if q.rubric_id is not null and _rubric is not null and jsonb_array_length(_rubric) > 0 then
    if exists (
         select 1 from jsonb_array_elements(_rubric) e
          left join public.rubric_criteria c on c.id = (e ->> 'criterion_id')::uuid and c.rubric_id = q.rubric_id
          where c.id is null or (e ->> 'points')::numeric < 0 or (e ->> 'points')::numeric > c.max_points)
       or (select count(distinct e ->> 'criterion_id') from jsonb_array_elements(_rubric) e)
          <> (select count(*) from public.rubric_criteria where rubric_id = q.rubric_id) then
      raise exception 'CQ_INVALID_RUBRIC' using errcode = 'check_violation';
    end if;
    -- rubric points are scaled to the quest's max score
    select round(sum((e ->> 'points')::numeric) / (select sum(max_points) from public.rubric_criteria
             where rubric_id = q.rubric_id) * q.max_score, 2)
      into total from jsonb_array_elements(_rubric) e;
  else
    total := _score;
  end if;
  if _decision = 'approved' and total is null then
    raise exception 'CQ_SCORE_REQUIRED' using errcode = 'check_violation';
  end if;
  if total is not null and (total < 0 or total > q.max_score) then
    raise exception 'CQ_SCORE_OUT_OF_RANGE' using errcode = 'check_violation';
  end if;

  insert into public.quest_reviews (submission_id, course_id, reviewer_id, decision, score, feedback, idempotency_key)
  values (s.id, s.course_id, (select auth.uid()), _decision, total, coalesce(btrim(_feedback), ''), _idempotency_key)
  returning * into review;

  if q.rubric_id is not null and _rubric is not null then
    insert into public.rubric_results (review_id, criterion_id, points)
    select review.id, (e ->> 'criterion_id')::uuid, (e ->> 'points')::numeric from jsonb_array_elements(_rubric) e;
  end if;

  update public.quest_submissions set status = _decision::text::public.submission_status where id = s.id;

  if _decision = 'approved' and q.xp_reward > 0 then
    insert into public.xp_transactions (user_id, course_id, amount, source_type, source_id, reason, created_by)
    values (s.user_id, s.course_id, q.xp_reward, 'quest', q.id, 'quest_approved', (select auth.uid()))
    on conflict (user_id, source_type, source_id, reason) do nothing; -- one award per quest, ever
  end if;

  perform private.write_audit('submission.reviewed', 'quest_submissions', s.id, null,
    jsonb_build_object('decision', _decision, 'score', total));
  return review;
end $$;

revoke all on function public.save_quest_rubric(uuid, jsonb) from public, anon;
revoke all on function public.review_submission(uuid, public.review_decision, numeric, text, jsonb, text) from public, anon;
grant execute on function public.save_quest_rubric(uuid, jsonb) to authenticated;
grant execute on function public.review_submission(uuid, public.review_decision, numeric, text, jsonb, text) to authenticated;

create or replace function public.clone_course(_source_id uuid, _term smallint, _academic_year smallint,
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

  -- rubrics, quests (+ prerequisites); never submissions/reviews/XP
  create temporary table rubric_map (old_ref uuid, new_ref uuid) on commit drop;
  create temporary table quest_map (old_ref uuid, new_ref uuid) on commit drop;

  with src_rubrics as (
    select r.*, gen_random_uuid() as nid from public.rubrics r where r.course_id = _source_id
  ), ins as (
    insert into public.rubrics (id, course_id, title) select nid, v_course, title from src_rubrics returning id
  )
  insert into rubric_map select id, nid from src_rubrics;

  insert into public.rubric_criteria (rubric_id, position, name, description, max_points)
  select m.new_ref, c.position, c.name, c.description, c.max_points
  from public.rubric_criteria c join rubric_map m on m.old_ref = c.rubric_id;

  with src_quests as (
    select q.*, gen_random_uuid() as nid from public.quests q where q.course_id = _source_id
  ), ins as (
    insert into public.quests (id, course_id, unit_id, type, title, description_md, objectives, quest_stage,
      difficulty, max_score, xp_reward, due_at, allow_late, submit_modes, classroom_url, max_attempts,
      position, published, rubric_id)
    select s.nid, v_course, um.new_ref, s.type, s.title, s.description_md, s.objectives, s.quest_stage,
      s.difficulty, s.max_score, s.xp_reward, null, s.allow_late,
      -- Classroom links belong to the old class; drop the classroom mode when cloning
      coalesce(nullif(array_remove(s.submit_modes, 'classroom'), '{}'), array['text', 'url']),
      null, s.max_attempts, s.position, false, rm.new_ref
    from src_quests s
    left join unit_map um on um.old_ref = s.unit_id
    left join rubric_map rm on rm.old_ref = s.rubric_id
    returning id
  )
  insert into quest_map select id, nid from src_quests;

  insert into public.quest_prerequisites (quest_id, required_quest_id)
  select a.new_ref, b.new_ref
  from public.quest_prerequisites p
  join quest_map a on a.old_ref = p.quest_id
  join quest_map b on b.old_ref = p.required_quest_id;

  perform private.write_audit('course.cloned', 'courses', v_course,
    jsonb_build_object('source_course_id', _source_id), null);
  return v_course;
end $$;

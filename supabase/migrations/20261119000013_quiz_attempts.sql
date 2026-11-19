-- P4-02: quiz attempts. Questions are served without answers; grading happens only on the server.

create type public.attempt_status as enum ('in_progress', 'submitted', 'graded');

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  attempt_no smallint not null check (attempt_no >= 1),
  question_ids uuid[] not null,
  option_orders jsonb not null default '{}'::jsonb, -- question_id -> [option ids] as shown
  status public.attempt_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  deadline_at timestamptz,
  submitted_at timestamptz,
  score numeric(7, 2),
  max_score numeric(7, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quiz_id, user_id, attempt_no)
);
create index quiz_attempts_quiz_idx on public.quiz_attempts (quiz_id, status);
create index quiz_attempts_user_idx on public.quiz_attempts (user_id, course_id);
create trigger quiz_attempts_updated_at before update on public.quiz_attempts
  for each row execute function private.set_updated_at();

create table public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete restrict,
  option_id uuid references public.question_options (id) on delete set null,
  answer_text text check (char_length(answer_text) <= 2000),
  is_correct boolean,             -- null = waiting for manual grading
  points numeric(5, 2),
  graded_by uuid references public.profiles (id) on delete set null,
  feedback text not null default '' check (char_length(feedback) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);
create trigger quiz_answers_updated_at before update on public.quiz_answers
  for each row execute function private.set_updated_at();

alter table public.quiz_attempts enable row level security;
alter table public.quiz_answers enable row level security;
-- attempts (score/status) are visible to the owner and course teachers; per-answer correctness only via RPC
create policy attempts_read on public.quiz_attempts for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_course_teacher(course_id)));
create policy answers_teacher_read on public.quiz_answers for select to authenticated
  using (exists (select 1 from public.quiz_attempts a where a.id = attempt_id and (select private.is_course_teacher(a.course_id))));
revoke insert, update, delete on public.quiz_attempts, public.quiz_answers from authenticated;

-- ---------------------------------------------------------------- helpers
create function private.normalize_answer(_s text) returns text
language sql immutable set search_path = '' as $$
  select lower(regexp_replace(btrim(coalesce(_s, '')), '\s+', ' ', 'g'));
$$;

-- questions for an attempt, in the attempt's order, WITHOUT is_correct / explanation
create function private.attempt_payload(_attempt_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'attempt_id', a.id, 'quiz_id', a.quiz_id, 'deadline_at', a.deadline_at, 'status', a.status,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'type', q.type, 'stem', q.stem, 'points', q.points,
        'options', case when q.type = 'short' then '[]'::jsonb else coalesce((
          select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label) order by oo.ord)
            from jsonb_array_elements_text(a.option_orders -> q.id::text) with ordinality oo(oid, ord)
            join public.question_options o on o.id = oo.oid::uuid), '[]'::jsonb) end)
        order by qi.ord)
      from unnest(a.question_ids) with ordinality qi(qid, ord) join public.questions q on q.id = qi.qid), '[]'::jsonb))
  from public.quiz_attempts a where a.id = _attempt_id;
$$;

create function private.finalize_attempt(_attempt_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.quiz_attempts;
  z public.quizzes;
begin
  select * into a from public.quiz_attempts where id = _attempt_id for update;
  update public.quiz_attempts
     set score = (select coalesce(sum(points), 0) from public.quiz_answers where attempt_id = a.id),
         status = case when exists (select 1 from public.quiz_answers where attempt_id = a.id and is_correct is null)
                       then 'submitted'::public.attempt_status else 'graded'::public.attempt_status end
   where id = a.id
  returning * into a;
  if a.status <> 'graded' then return; end if;

  select * into z from public.quizzes where id = a.quiz_id;
  if a.max_score > 0 and a.score / a.max_score * 100 >= z.passing_percent then
    perform private.award_xp(a.user_id, a.course_id, z.xp_reward, 'quiz', z.id, 'quiz_passed');
  end if;
  -- competency evidence: % per competency across this attempt's questions
  perform private.record_competency(q.competency_id, a.course_id, a.user_id,
            sum(coalesce(ans.points, 0)) / sum(q.points) * 100, 'quiz', a.id, null, z.title)
     from unnest(a.question_ids) qid
     join public.questions q on q.id = qid
     left join public.quiz_answers ans on ans.attempt_id = a.id and ans.question_id = q.id
    where q.competency_id is not null
    group by q.competency_id;
end $$;

-- ---------------------------------------------------------------- start / resume
create function public.start_quiz_attempt(_quiz_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  z public.quizzes;
  existing public.quiz_attempts;
  n_done integer;
  qids uuid[];
  orders jsonb;
  new_id uuid;
begin
  select * into z from public.quizzes where id = _quiz_id;
  if not found or not z.published or not private.has_role('student')
     or not private.can_view_course_content(z.course_id) then
    raise exception 'CQ_FORBIDDEN' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(_quiz_id::text || uid::text, 1));

  select * into existing from public.quiz_attempts
   where quiz_id = _quiz_id and user_id = uid and status = 'in_progress'
   order by attempt_no desc limit 1;
  if found then
    if existing.deadline_at is null or now() <= existing.deadline_at then
      return private.attempt_payload(existing.id); -- resume (e.g. page reload)
    end if;
    perform public.submit_quiz_attempt(existing.id, '[]'::jsonb); -- time is up: close it
  end if;

  if (z.available_from is not null and now() < z.available_from)
     or (z.available_until is not null and now() > z.available_until) then
    raise exception 'CQ_NOT_AVAILABLE' using errcode = 'check_violation';
  end if;
  select count(*) into n_done from public.quiz_attempts where quiz_id = _quiz_id and user_id = uid;
  if n_done >= z.max_attempts then
    raise exception 'CQ_NO_ATTEMPTS_LEFT' using errcode = 'check_violation';
  end if;

  select array_agg(question_id order by case when z.shuffle_questions then random() else position end)
    into qids from public.quiz_questions where quiz_id = _quiz_id;
  if qids is null then
    raise exception 'CQ_NO_QUESTIONS' using errcode = 'check_violation';
  end if;
  if z.questions_per_attempt is not null then
    qids := qids[1:z.questions_per_attempt];
  end if;
  select coalesce(jsonb_object_agg(q.id, (
           select jsonb_agg(o.id order by case when z.shuffle_options and q.type = 'mc' then random() else o.position end)
             from public.question_options o where o.question_id = q.id)), '{}'::jsonb)
    into orders from public.questions q where q.id = any (qids) and q.type <> 'short';

  insert into public.quiz_attempts (quiz_id, course_id, user_id, attempt_no, question_ids, option_orders, deadline_at, max_score)
  values (_quiz_id, z.course_id, uid, n_done + 1, qids, orders,
          case when z.time_limit_minutes is null then null else now() + make_interval(mins => z.time_limit_minutes) end,
          (select sum(points) from public.questions where id = any (qids)))
  returning id into new_id;
  return private.attempt_payload(new_id);
end $$;

-- ---------------------------------------------------------------- submit + auto-grade
create function public.submit_quiz_attempt(_attempt_id uuid, _answers jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a public.quiz_attempts;
  accept boolean;
begin
  select * into a from public.quiz_attempts where id = _attempt_id for update;
  if not found or a.user_id <> (select auth.uid()) then
    raise exception 'CQ_FORBIDDEN' using errcode = '42501';
  end if;
  if a.status <> 'in_progress' then
    raise exception 'CQ_ALREADY_SUBMITTED' using errcode = 'check_violation';
  end if;
  -- 60 s grace for network latency; later answers are discarded (attempt still closes)
  accept := a.deadline_at is null or now() <= a.deadline_at + interval '60 seconds';

  insert into public.quiz_answers (attempt_id, question_id, option_id, answer_text, is_correct, points)
  select a.id, q.id,
         case when q.type <> 'short' then o.id end,
         case when q.type = 'short' then left(ans ->> 'text', 2000) end,
         case
           when q.type <> 'short' then coalesce(o.is_correct, false)
           when not exists (select 1 from public.question_options x where x.question_id = q.id) then null -- manual
           else exists (select 1 from public.question_options x where x.question_id = q.id
                         and private.normalize_answer(x.label) = private.normalize_answer(ans ->> 'text'))
         end,
         null
    from unnest(a.question_ids) qid
    join public.questions q on q.id = qid
    left join lateral (
      select e from jsonb_array_elements(case when accept then coalesce(_answers, '[]'::jsonb) else '[]'::jsonb end) e
       where e ->> 'question_id' = q.id::text limit 1) x(ans) on true
    left join public.question_options o
      on o.id = nullif(ans ->> 'option_id', '')::uuid and o.question_id = q.id
     -- an option id is only valid if it was shown in this attempt
     and (a.option_orders -> q.id::text) ? o.id::text;

  update public.quiz_answers set points = case when is_correct then (select points from public.questions where id = question_id) else 0 end
   where attempt_id = a.id and is_correct is not null;
  update public.quiz_attempts set submitted_at = now(), status = 'submitted' where id = a.id;
  perform private.finalize_attempt(a.id);

  return (select jsonb_build_object('status', status, 'score', score, 'max_score', max_score)
            from public.quiz_attempts where id = a.id);
end $$;

-- ---------------------------------------------------------------- manual grading (short answers)
create function public.grade_quiz_answer(_answer_id uuid, _points numeric, _feedback text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  ans public.quiz_answers;
  a public.quiz_attempts;
  maxp numeric;
begin
  select * into ans from public.quiz_answers where id = _answer_id for update;
  select * into a from public.quiz_attempts where id = ans.attempt_id;
  if not found or not private.is_course_teacher(a.course_id) then
    raise exception 'CQ_FORBIDDEN' using errcode = '42501';
  end if;
  if a.status = 'in_progress' then
    raise exception 'CQ_NOT_SUBMITTED' using errcode = 'check_violation';
  end if;
  select points into maxp from public.questions where id = ans.question_id;
  if _points is null or _points < 0 or _points > maxp then
    raise exception 'CQ_SCORE_OUT_OF_RANGE' using errcode = 'check_violation';
  end if;
  update public.quiz_answers
     set points = _points, is_correct = _points > 0, graded_by = (select auth.uid()), feedback = coalesce(_feedback, '')
   where id = ans.id;
  perform private.finalize_attempt(a.id); -- idempotent: XP/competency upserts are unique per source
  perform private.write_audit('quiz_answer.graded', 'quiz_answers', ans.id, jsonb_build_object('points', ans.points),
    jsonb_build_object('points', _points));
end $$;

-- ---------------------------------------------------------------- result (answers only after answers_visible_at)
create function public.get_attempt_result(_attempt_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  a public.quiz_attempts;
  z public.quizzes;
  teacher boolean;
  reveal boolean;
begin
  select * into a from public.quiz_attempts where id = _attempt_id;
  if not found then raise exception 'CQ_FORBIDDEN' using errcode = '42501'; end if;
  teacher := private.is_course_teacher(a.course_id);
  if a.user_id <> (select auth.uid()) and not teacher then
    raise exception 'CQ_FORBIDDEN' using errcode = '42501';
  end if;
  if a.status = 'in_progress' then
    raise exception 'CQ_NOT_SUBMITTED' using errcode = 'check_violation';
  end if;
  select * into z from public.quizzes where id = a.quiz_id;
  reveal := teacher or (z.answers_visible_at is not null and now() >= z.answers_visible_at);

  return jsonb_build_object(
    'attempt_id', a.id, 'quiz_id', a.quiz_id, 'status', a.status, 'score', a.score, 'max_score', a.max_score,
    'passing_percent', z.passing_percent, 'submitted_at', a.submitted_at, 'answers_revealed', reveal,
    'answers_visible_at', z.answers_visible_at,
    'questions', case when not reveal then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'type', q.type, 'stem', q.stem, 'points', q.points, 'explanation', q.explanation,
        'answer_id', ans.id, 'my_option_id', ans.option_id, 'my_text', ans.answer_text,
        'is_correct', ans.is_correct, 'earned', ans.points, 'feedback', ans.feedback,
        'options', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'is_correct', o.is_correct)
                                              order by o.position), '[]'::jsonb)
                      from public.question_options o where o.question_id = q.id))
        order by qi.ord)
      from unnest(a.question_ids) with ordinality qi(qid, ord)
      join public.questions q on q.id = qi.qid
      left join public.quiz_answers ans on ans.attempt_id = a.id and ans.question_id = q.id), '[]'::jsonb) end);
end $$;

revoke all on function private.attempt_payload(uuid), private.finalize_attempt(uuid) from public;
revoke all on function public.start_quiz_attempt(uuid), public.submit_quiz_attempt(uuid, jsonb),
  public.grade_quiz_answer(uuid, numeric, text), public.get_attempt_result(uuid) from public, anon;
grant execute on function public.start_quiz_attempt(uuid), public.submit_quiz_attempt(uuid, jsonb),
  public.grade_quiz_answer(uuid, numeric, text), public.get_attempt_result(uuid) to authenticated;

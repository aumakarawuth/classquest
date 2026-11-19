-- P4-01: quizzes (pre/post-test, quiz, practical), question bank, options.
-- Students never read questions/options directly: they are served (without answers) by attempt RPCs (P4-02).

create type public.quiz_kind as enum ('pretest', 'posttest', 'quiz', 'practical');
create type public.question_type as enum ('mc', 'tf', 'short');

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  unit_id uuid references public.learning_units (id) on delete set null,
  kind public.quiz_kind not null default 'quiz',
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 5000),
  time_limit_minutes smallint check (time_limit_minutes between 1 and 300),
  shuffle_questions boolean not null default true,
  shuffle_options boolean not null default true,
  questions_per_attempt smallint check (questions_per_attempt between 1 and 200), -- null = all
  max_attempts smallint not null default 1 check (max_attempts between 1 and 20),
  available_from timestamptz,
  available_until timestamptz,
  answers_visible_at timestamptz, -- null = never show correct answers to students
  passing_percent numeric(5, 2) not null default 50 check (passing_percent between 0 and 100),
  xp_reward integer not null default 0 check (xp_reward between 0 and 10000),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (available_until is null or available_from is null or available_until > available_from)
);
create index quizzes_course_idx on public.quizzes (course_id);
create trigger quizzes_updated_at before update on public.quizzes
  for each row execute function private.set_updated_at();

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  type public.question_type not null,
  stem text not null check (char_length(stem) between 1 and 5000),
  explanation text not null default '' check (char_length(explanation) <= 5000),
  points numeric(5, 2) not null default 1 check (points > 0),
  competency_id uuid references public.competencies (id) on delete set null,
  bank_tag text not null default '' check (char_length(bank_tag) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index questions_course_idx on public.questions (course_id, bank_tag);
create trigger questions_updated_at before update on public.questions
  for each row execute function private.set_updated_at();

-- mc/tf: choices; short: accepted answers (all is_correct = true, matched case/space-insensitively)
create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  position smallint not null check (position >= 1),
  label text not null check (char_length(label) between 1 and 1000),
  is_correct boolean not null default false,
  unique (question_id, position)
);

create table public.quiz_questions (
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete restrict,
  position smallint not null check (position >= 1),
  primary key (quiz_id, question_id),
  unique (quiz_id, position) deferrable initially deferred
);
create index quiz_questions_question_idx on public.quiz_questions (question_id);

alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.quiz_questions enable row level security;

create policy quizzes_read on public.quizzes for select to authenticated using (
  (select private.is_course_teacher(course_id)) or (published and (select private.can_view_course_content(course_id))));
create policy quizzes_teacher_write on public.quizzes for all to authenticated
  using ((select private.is_course_teacher(course_id))) with check ((select private.is_course_teacher(course_id)));

-- question bank + answers: course teachers only
create policy questions_teacher on public.questions for select to authenticated
  using ((select private.is_course_teacher(course_id)));
create policy question_options_teacher on public.question_options for select to authenticated
  using (exists (select 1 from public.questions q where q.id = question_id and (select private.is_course_teacher(q.course_id))));
create policy quiz_questions_teacher on public.quiz_questions for select to authenticated
  using (exists (select 1 from public.quizzes z where z.id = quiz_id and (select private.is_course_teacher(z.course_id))));
revoke insert, update, delete on public.questions, public.question_options, public.quiz_questions from authenticated;
create policy questions_teacher_delete on public.questions for delete to authenticated
  using ((select private.is_course_teacher(course_id)));
grant delete on public.questions to authenticated;

-- ---------------------------------------------------------------- save_question (atomic, validated)
create function public.save_question(_question_id uuid, _course_id uuid, _q jsonb)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  qid uuid := _question_id;
  qtype public.question_type := (_q ->> 'type')::public.question_type;
  opts jsonb := coalesce(_q -> 'options', '[]'::jsonb);
  n_opts integer := jsonb_array_length(coalesce(_q -> 'options', '[]'::jsonb));
  n_correct integer;
begin
  if not private.is_course_teacher(_course_id)
     or (qid is not null and not exists (select 1 from public.questions where id = qid and course_id = _course_id)) then
    raise exception 'CQ_FORBIDDEN' using errcode = '42501';
  end if;
  select count(*) into n_correct from jsonb_array_elements(opts) o where (o ->> 'is_correct')::boolean;
  if (qtype = 'mc' and (n_opts < 2 or n_opts > 8 or n_correct <> 1))
     or (qtype = 'tf' and (n_opts <> 2 or n_correct <> 1))
     or (qtype = 'short' and (n_opts > 10 or n_correct <> n_opts))
     or exists (select 1 from jsonb_array_elements(opts) o where btrim(coalesce(o ->> 'label', '')) = '') then
    raise exception 'CQ_INVALID_QUESTION' using errcode = 'check_violation';
  end if;
  if nullif(_q ->> 'competency_id', '') is not null and not exists (
       select 1 from public.competencies where id = (_q ->> 'competency_id')::uuid and course_id = _course_id) then
    raise exception 'CQ_INVALID_QUESTION: competency not in course' using errcode = 'check_violation';
  end if;

  if qid is null then
    insert into public.questions (course_id, type, stem, explanation, points, competency_id, bank_tag)
    values (_course_id, qtype, btrim(_q ->> 'stem'), coalesce(_q ->> 'explanation', ''),
            coalesce((_q ->> 'points')::numeric, 1), nullif(_q ->> 'competency_id', '')::uuid, coalesce(btrim(_q ->> 'bank_tag'), ''))
    returning id into qid;
  else
    update public.questions set type = qtype, stem = btrim(_q ->> 'stem'), explanation = coalesce(_q ->> 'explanation', ''),
           points = coalesce((_q ->> 'points')::numeric, 1), competency_id = nullif(_q ->> 'competency_id', '')::uuid,
           bank_tag = coalesce(btrim(_q ->> 'bank_tag'), '')
     where id = qid;
    delete from public.question_options where question_id = qid;
  end if;

  insert into public.question_options (question_id, position, label, is_correct)
  select qid, ord, btrim(o ->> 'label'), coalesce((o ->> 'is_correct')::boolean, false)
    from jsonb_array_elements(opts) with ordinality t(o, ord);
  return qid;
end $$;

create function public.set_quiz_questions(_quiz_id uuid, _question_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  cid uuid;
begin
  select course_id into cid from public.quizzes where id = _quiz_id;
  if cid is null or not private.is_course_teacher(cid) then
    raise exception 'CQ_FORBIDDEN' using errcode = '42501';
  end if;
  if exists (select 1 from unnest(_question_ids) i
              where not exists (select 1 from public.questions q where q.id = i and q.course_id = cid))
     or cardinality(_question_ids) <> (select count(distinct i) from unnest(_question_ids) i) then
    raise exception 'CQ_INVALID_QUESTION' using errcode = 'check_violation';
  end if;
  delete from public.quiz_questions where quiz_id = _quiz_id;
  insert into public.quiz_questions (quiz_id, question_id, position)
  select _quiz_id, i, ord from unnest(_question_ids) with ordinality t(i, ord);
end $$;

revoke all on function public.save_question(uuid, uuid, jsonb), public.set_quiz_questions(uuid, uuid[]) from public, anon;
grant execute on function public.save_question(uuid, uuid, jsonb), public.set_quiz_questions(uuid, uuid[]) to authenticated;

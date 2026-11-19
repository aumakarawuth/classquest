-- P2-05: quests, prerequisites, submissions, submission file storage.

create type public.quest_type as enum ('main', 'side', 'daily', 'weekly', 'challenge', 'boss');
create type public.submission_status as enum ('submitted', 'needs_revision', 'approved');

-- ---------------------------------------------------------------- quests
create table public.quests (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  unit_id uuid references public.learning_units (id) on delete set null,
  type public.quest_type not null default 'main',
  title text not null check (char_length(title) between 1 and 200),
  description_md text not null default '' check (char_length(description_md) <= 20000),
  objectives text not null default '' check (char_length(objectives) <= 5000),
  quest_stage public.quest_stage,
  difficulty smallint not null default 1 check (difficulty between 1 and 5),
  max_score numeric(6, 2) not null default 10 check (max_score >= 0),
  xp_reward integer not null default 100 check (xp_reward between 0 and 10000),
  due_at timestamptz,
  allow_late boolean not null default true,
  -- how students may submit: text, url, file; 'classroom' = submitted in Google Classroom (link only)
  submit_modes text[] not null default array['text', 'url']
    check (cardinality(submit_modes) > 0 and submit_modes <@ array['text', 'url', 'file', 'classroom']),
  classroom_url text check (classroom_url ~ '^https://classroom\.google\.com/'),
  max_attempts smallint not null default 3 check (max_attempts between 1 and 20),
  position integer not null default 1,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ('classroom' <> all (submit_modes) or classroom_url is not null)
);
create index quests_course_idx on public.quests (course_id, position);
create index quests_unit_idx on public.quests (unit_id);
create trigger quests_updated_at before update on public.quests
  for each row execute function private.set_updated_at();

create function private.quest_unit_in_course() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.unit_id is not null and not exists (
       select 1 from public.learning_units where id = new.unit_id and course_id = new.course_id) then
    raise exception 'CQ_UNIT_COURSE_MISMATCH' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger quests_unit_in_course before insert or update of unit_id, course_id on public.quests
  for each row execute function private.quest_unit_in_course();

create table public.quest_prerequisites (
  quest_id uuid not null references public.quests (id) on delete cascade,
  required_quest_id uuid not null references public.quests (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (quest_id, required_quest_id),
  check (quest_id <> required_quest_id)
);
create index quest_prerequisites_required_idx on public.quest_prerequisites (required_quest_id);

-- ---------------------------------------------------------------- submissions
create table public.quest_submissions (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references public.quests (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  attempt_no smallint not null check (attempt_no >= 1),
  content_text text check (char_length(content_text) <= 10000),
  url text check (url ~ '^https://' and char_length(url) <= 2000),
  storage_path text,
  status public.submission_status not null default 'submitted',
  is_late boolean not null default false,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quest_id, user_id, attempt_no),
  check (content_text is not null or url is not null or storage_path is not null)
);
create index quest_submissions_user_idx on public.quest_submissions (user_id, quest_id);
create index quest_submissions_review_idx on public.quest_submissions (course_id, status, submitted_at);
create trigger quest_submissions_updated_at before update on public.quest_submissions
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------- RLS
alter table public.quests enable row level security;
alter table public.quest_prerequisites enable row level security;
alter table public.quest_submissions enable row level security;

create policy quests_read on public.quests for select to authenticated using (
  (select private.is_course_teacher(course_id)) or (select private.has_role('admin'))
  or (published and (select private.can_view_course_content(course_id))));
create policy quests_teacher_write on public.quests for all to authenticated
  using ((select private.is_course_teacher(course_id))) with check ((select private.is_course_teacher(course_id)));

create policy quest_prereq_read on public.quest_prerequisites for select to authenticated
  using (exists (select 1 from public.quests q where q.id = quest_id));
create policy quest_prereq_teacher_write on public.quest_prerequisites for all to authenticated
  using (exists (select 1 from public.quests q where q.id = quest_id and (select private.is_course_teacher(q.course_id))))
  with check (exists (
    select 1 from public.quests q join public.quests r on r.id = required_quest_id and r.course_id = q.course_id
     where q.id = quest_id and (select private.is_course_teacher(q.course_id))));

create policy submissions_read on public.quest_submissions for select to authenticated using (
  user_id = (select auth.uid()) or (select private.is_course_teacher(course_id)));
revoke insert, update, delete on public.quest_submissions from authenticated;

-- ---------------------------------------------------------------- submit_quest
create function public.submit_quest(_quest_id uuid, _text text default null, _url text default null,
  _storage_path text default null)
returns public.quest_submissions
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  q public.quests;
  last public.quest_submissions;
  row public.quest_submissions;
  late boolean := false;
begin
  select * into q from public.quests where id = _quest_id;
  if not found or not q.published or not private.has_role('student')
     or not private.can_view_course_content(q.course_id) then
    raise exception 'CQ_FORBIDDEN' using errcode = '42501';
  end if;

  _text := nullif(btrim(_text), '');
  _url := nullif(btrim(_url), '');
  _storage_path := nullif(btrim(_storage_path), '');
  if _text is null and _url is null and _storage_path is null then
    raise exception 'CQ_EMPTY_SUBMISSION' using errcode = 'check_violation';
  end if;
  if (_text is not null and 'text' <> all (q.submit_modes))
     or (_url is not null and 'url' <> all (q.submit_modes))
     or (_storage_path is not null and 'file' <> all (q.submit_modes)) then
    raise exception 'CQ_MODE_NOT_ALLOWED' using errcode = 'check_violation';
  end if;
  if _storage_path is not null and (
       _storage_path not like q.course_id::text || '/' || uid::text || '/%'
       or not exists (select 1 from storage.objects o
                       where o.bucket_id = 'submissions' and o.name = _storage_path and o.owner = uid)) then
    raise exception 'CQ_INVALID_FILE' using errcode = 'check_violation';
  end if;

  if exists (
       select 1 from public.quest_prerequisites p
        where p.quest_id = _quest_id
          and not exists (select 1 from public.quest_submissions s
                           where s.quest_id = p.required_quest_id and s.user_id = uid and s.status = 'approved')) then
    raise exception 'CQ_LOCKED' using errcode = 'check_violation';
  end if;

  -- serialise concurrent submits from the same student for this quest
  perform pg_advisory_xact_lock(hashtextextended(_quest_id::text || uid::text, 0));

  select * into last from public.quest_submissions
   where quest_id = _quest_id and user_id = uid order by attempt_no desc limit 1;
  if found and last.status <> 'needs_revision' then
    raise exception 'CQ_ALREADY_SUBMITTED' using errcode = 'check_violation';
  end if;
  if coalesce(last.attempt_no, 0) >= q.max_attempts then
    raise exception 'CQ_NO_ATTEMPTS_LEFT' using errcode = 'check_violation';
  end if;

  if q.due_at is not null and now() > q.due_at then
    if not q.allow_late then
      raise exception 'CQ_PAST_DUE' using errcode = 'check_violation';
    end if;
    late := true;
  end if;

  insert into public.quest_submissions (quest_id, course_id, user_id, attempt_no, content_text, url, storage_path, is_late)
  values (_quest_id, q.course_id, uid, coalesce(last.attempt_no, 0) + 1, _text, _url, _storage_path, late)
  returning * into row;
  return row;
end $$;

revoke all on function public.submit_quest(uuid, text, text, text) from public, anon;
grant execute on function public.submit_quest(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------- storage: private bucket, 2 MB, images/PDF only
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('submissions', 'submissions', false, 2097152,
        array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- path: {course_id}/{user_id}/{file}
create policy submissions_upload_own on storage.objects for insert to authenticated with check (
  bucket_id = 'submissions'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and (select private.is_course_member(((storage.foldername(name))[1])::uuid))
);
create policy submissions_read_own_or_teacher on storage.objects for select to authenticated using (
  bucket_id = 'submissions'
  and ((storage.foldername(name))[2] = (select auth.uid())::text
       or (select private.is_course_teacher(((storage.foldername(name))[1])::uuid)))
);

-- P6-02: student portfolio (private by default), featured work, reflections.

create table public.portfolios (
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  visibility text not null default 'private' check (visibility in ('private', 'teacher')),
  headline text not null default '' check (char_length(headline) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id)
);
create trigger portfolios_updated_at before update on public.portfolios
  for each row execute function private.set_updated_at();

create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  submission_id uuid not null references public.quest_submissions (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 2000),
  position integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, submission_id)
);
create trigger portfolio_items_updated_at before update on public.portfolio_items
  for each row execute function private.set_updated_at();

create table public.student_reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  target_type text not null default 'course' check (target_type in ('course', 'lesson', 'quest', 'lab', 'quiz')),
  target_id uuid,
  prompt text not null default '' check (char_length(prompt) <= 300),
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index student_reflections_user_idx on public.student_reflections (user_id, course_id);
create trigger student_reflections_updated_at before update on public.student_reflections
  for each row execute function private.set_updated_at();

-- featured work must be the student's own APPROVED submission in that course
create function private.portfolio_item_valid() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.quest_submissions s
                  where s.id = new.submission_id and s.user_id = new.user_id
                    and s.course_id = new.course_id and s.status = 'approved') then
    raise exception 'CQ_INVALID_PORTFOLIO_ITEM' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger portfolio_items_valid before insert or update on public.portfolio_items
  for each row execute function private.portfolio_item_valid();

create function private.portfolio_shared_with_me(_user uuid, _course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_course_teacher(_course)
     and exists (select 1 from public.portfolios where user_id = _user and course_id = _course and visibility = 'teacher');
$$;
revoke all on function private.portfolio_shared_with_me(uuid, uuid) from public;
grant execute on function private.portfolio_shared_with_me(uuid, uuid) to authenticated;

alter table public.portfolios enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.student_reflections enable row level security;

create policy portfolios_own on public.portfolios for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select private.is_course_member(course_id)));
create policy portfolios_teacher_read on public.portfolios for select to authenticated
  using (visibility = 'teacher' and (select private.is_course_teacher(course_id)));

create policy portfolio_items_own on public.portfolio_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy portfolio_items_teacher_read on public.portfolio_items for select to authenticated
  using ((select private.portfolio_shared_with_me(user_id, course_id)));

-- reflections are learning evidence: teachers of the course may always read them (stated in the UI)
create policy reflections_own on public.student_reflections for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select private.is_course_member(course_id)));
create policy reflections_teacher_read on public.student_reflections for select to authenticated
  using ((select private.is_course_teacher(course_id)));

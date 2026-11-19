-- P5-02: Virtual Lab activities (Wokwi). No simulator is built: labs link (or, when allowed, embed) Wokwi projects.
-- Evidence is submitted through a linked quest, so there is one submission/review flow.

create table public.virtual_labs (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  unit_id uuid references public.learning_units (id) on delete set null,
  quest_id uuid references public.quests (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  platform text not null default 'wokwi' check (platform in ('wokwi')),
  project_url text not null check (project_url ~ '^https://wokwi\.com/projects/[A-Za-z0-9_-]+'),
  allow_embed boolean not null default false,
  instructions_md text not null default '' check (char_length(instructions_md) <= 20000),
  diagram_url text check (diagram_url ~ '^https://' and char_length(diagram_url) <= 2000),
  source_code text not null default '' check (char_length(source_code) <= 20000),
  expected_result text not null default '' check (char_length(expected_result) <= 5000),
  components text[] not null default '{}', -- e.g. Arduino, ESP32, LED, Ultrasonic
  position integer not null default 1,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index virtual_labs_course_idx on public.virtual_labs (course_id, position);
create trigger virtual_labs_updated_at before update on public.virtual_labs
  for each row execute function private.set_updated_at();

create function private.lab_links_same_course() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.unit_id is not null and not exists (select 1 from public.learning_units where id = new.unit_id and course_id = new.course_id))
     or (new.quest_id is not null and not exists (select 1 from public.quests where id = new.quest_id and course_id = new.course_id)) then
    raise exception 'CQ_COURSE_MISMATCH' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger virtual_labs_same_course before insert or update on public.virtual_labs
  for each row execute function private.lab_links_same_course();

alter table public.virtual_labs enable row level security;
create policy labs_read on public.virtual_labs for select to authenticated using (
  (select private.is_course_teacher(course_id)) or (published and (select private.can_view_course_content(course_id))));
create policy labs_teacher_write on public.virtual_labs for all to authenticated
  using ((select private.is_course_teacher(course_id))) with check ((select private.is_course_teacher(course_id)));

-- P3-02: badges (global + per course), automatic rules, manual awards, idempotent awarding.

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses (id) on delete cascade, -- null = available in every course
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  icon text not null default 'award'
    check (icon in ('award', 'medal', 'trophy', 'star', 'zap', 'flame', 'rocket', 'crown', 'cpu', 'wifi', 'lightbulb', 'target')),
  xp_bonus integer not null default 0 check (xp_bonus between 0 and 1000),
  -- null = awarded manually by a teacher
  rule jsonb check (rule is null or (
    rule ->> 'type' in ('lessons_completed', 'quests_approved', 'boss_approved', 'level_reached')
    and coalesce((rule ->> 'count')::int, 1) between 1 and 1000)),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index badges_course_idx on public.badges (course_id);
create trigger badges_updated_at before update on public.badges
  for each row execute function private.set_updated_at();

create table public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_id uuid not null references public.badges (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  awarded_by uuid references public.profiles (id) on delete set null, -- null = automatic
  reason text not null default '' check (char_length(reason) <= 300),
  created_at timestamptz not null default now(),
  unique (user_id, badge_id, course_id)
);
create index user_badges_course_idx on public.user_badges (course_id);

-- default badges (configuration, not learner data)
insert into public.badges (course_id, name, description, icon, xp_bonus, rule) values
  (null, 'ก้าวแรก', 'เรียนบทเรียนแรกจบ', 'rocket', 10, '{"type":"lessons_completed","count":1}'),
  (null, 'นักผจญภัย', 'ผ่านภารกิจแรก', 'star', 20, '{"type":"quests_approved","count":1}'),
  (null, 'ไม่ยอมแพ้', 'ผ่านภารกิจครบ 5 ภารกิจ', 'flame', 50, '{"type":"quests_approved","count":5}'),
  (null, 'ผู้พิชิตบอส', 'ผ่าน Boss Quest', 'crown', 100, '{"type":"boss_approved","count":1}'),
  (null, 'Engineer', 'ถึงเลเวล 5', 'cpu', 0, '{"type":"level_reached","count":5}');

alter table public.badges enable row level security;
alter table public.user_badges enable row level security;

create policy badges_read on public.badges for select to authenticated using (
  course_id is null or (select private.can_view_course_content(course_id)));
create policy badges_admin_global on public.badges for all to authenticated
  using (course_id is null and (select private.has_role('admin')))
  with check (course_id is null and (select private.has_role('admin')));
create policy badges_teacher_course on public.badges for all to authenticated
  using (course_id is not null and (select private.is_course_teacher(course_id)))
  with check (course_id is not null and (select private.is_course_teacher(course_id)));

create policy user_badges_read on public.user_badges for select to authenticated using (
  user_id = (select auth.uid()) or (select private.is_course_teacher(course_id)));
revoke insert, update, delete on public.user_badges from authenticated;

-- ---------------------------------------------------------------- awarding
create function private.grant_badge(_user uuid, _badge uuid, _course uuid, _by uuid, _reason text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  bonus integer;
begin
  insert into public.user_badges (user_id, badge_id, course_id, awarded_by, reason)
  values (_user, _badge, _course, _by, coalesce(_reason, ''))
  on conflict (user_id, badge_id, course_id) do nothing;
  if not found then return false; end if;
  select xp_bonus into bonus from public.badges where id = _badge;
  perform private.award_xp(_user, _course, bonus, 'badge', _badge, 'badge_awarded');
  return true;
end $$;

create function private.evaluate_badges(_user uuid, _course uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  b record;
  value integer;
  xp_total integer;
begin
  select coalesce(sum(amount), 0) into xp_total from public.xp_transactions where user_id = _user and course_id = _course;
  for b in
    select * from public.badges
     where active and rule is not null and (course_id is null or course_id = _course)
       and not exists (select 1 from public.user_badges ub
                        where ub.user_id = _user and ub.badge_id = badges.id and ub.course_id = _course)
  loop
    value := case b.rule ->> 'type'
      when 'lessons_completed' then (
        select count(*) from public.lesson_progress p join public.lessons l on l.id = p.lesson_id
         where p.user_id = _user and l.course_id = _course and p.status = 'completed')
      when 'quests_approved' then (
        select count(distinct quest_id) from public.quest_submissions
         where user_id = _user and course_id = _course and status = 'approved')
      when 'boss_approved' then (
        select count(distinct s.quest_id) from public.quest_submissions s join public.quests q on q.id = s.quest_id
         where s.user_id = _user and s.course_id = _course and s.status = 'approved' and q.type = 'boss')
      when 'level_reached' then (
        select coalesce(max(level), 1) from (
          select level, xp_threshold from public.level_definitions where course_id = _course
          union all
          select level, xp_threshold from public.level_definitions
           where course_id is null and not exists (select 1 from public.level_definitions where course_id = _course)
        ) l where l.xp_threshold <= xp_total)
      else 0 end;
    if value >= coalesce((b.rule ->> 'count')::int, 1) then
      perform private.grant_badge(_user, b.id, _course, null, 'อัตโนมัติ');
    end if;
  end loop;
end $$;

-- every XP award is a progress event; re-evaluate rules (idempotent, terminates: each badge only once)
create function private.on_xp_awarded() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.evaluate_badges(new.user_id, new.course_id);
  return null;
end $$;
create trigger xp_transactions_evaluate_badges after insert on public.xp_transactions
  for each row execute function private.on_xp_awarded();

revoke all on function private.grant_badge(uuid, uuid, uuid, uuid, text), private.evaluate_badges(uuid, uuid) from public;

create function public.award_badge(_badge_id uuid, _user_id uuid, _course_id uuid, _reason text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  b public.badges;
begin
  select * into b from public.badges where id = _badge_id and active;
  if not found or not private.is_course_teacher(_course_id)
     or (b.course_id is not null and b.course_id <> _course_id)
     or not exists (select 1 from public.course_members
                     where course_id = _course_id and user_id = _user_id and member_role = 'student') then
    raise exception 'CQ_FORBIDDEN' using errcode = '42501';
  end if;
  if private.grant_badge(_user_id, _badge_id, _course_id, (select auth.uid()), _reason) then
    perform private.write_audit('badge.awarded', 'user_badges', _user_id, null,
      jsonb_build_object('badge_id', _badge_id, 'course_id', _course_id));
    return true;
  end if;
  return false;
end $$;
revoke all on function public.award_badge(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.award_badge(uuid, uuid, uuid, text) to authenticated;

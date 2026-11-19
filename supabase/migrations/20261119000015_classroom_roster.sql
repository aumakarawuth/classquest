-- P5-01: Google Classroom (link mode), roster import via CSV with invites, gradebook export.
-- Works entirely without the Google Classroom API.

create table public.classroom_connections (
  course_id uuid primary key references public.courses (id) on delete cascade,
  mode text not null default 'link' check (mode in ('link', 'api')),
  gc_link text not null check (gc_link ~ '^https://classroom\.google\.com/'),
  connected_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger classroom_connections_updated_at before update on public.classroom_connections
  for each row execute function private.set_updated_at();
alter table public.classroom_connections enable row level security;
create policy cc_read on public.classroom_connections for select to authenticated
  using ((select private.can_view_course_content(course_id)) or (select private.is_course_teacher(course_id)));
create policy cc_teacher_write on public.classroom_connections for all to authenticated
  using ((select private.is_course_teacher(course_id))) with check ((select private.is_course_teacher(course_id)));

-- teacher-provided roster: accounts appear only after the student's first Google sign-in
create table public.roster_invites (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  student_code text check (char_length(student_code) <= 32),
  display_name text check (char_length(display_name) <= 120),
  created_by uuid references public.profiles (id) on delete set null,
  claimed_by uuid references public.profiles (id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (course_id, email)
);
create index roster_invites_email_idx on public.roster_invites (email) where claimed_at is null;
alter table public.roster_invites enable row level security;
create policy invites_teacher_read on public.roster_invites for select to authenticated
  using ((select private.is_course_teacher(course_id)));
revoke insert, update, delete on public.roster_invites from authenticated;

-- An invited student is enrolled; a *pending* account with no other role is approved as student,
-- because the course teacher vouched for that school email. Never grants teacher/admin.
create function private.claim_invites(_user uuid, _email text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  inv record;
  n integer := 0;
begin
  for inv in select * from public.roster_invites where email = lower(_email) and claimed_at is null loop
    insert into public.course_members (course_id, user_id, member_role)
    values (inv.course_id, _user, 'student') on conflict (course_id, user_id) do nothing;
    update public.roster_invites set claimed_by = _user, claimed_at = now() where id = inv.id;
    if inv.student_code is not null then
      update public.profiles set student_code = inv.student_code
       where id = _user and student_code is null
         and not exists (select 1 from public.profiles where student_code = inv.student_code);
    end if;
    n := n + 1;
  end loop;
  if n > 0 and exists (select 1 from public.profiles where id = _user and status = 'pending')
     and not exists (select 1 from public.user_roles where user_id = _user) then
    update public.profiles set status = 'active', approved_at = now() where id = _user;
    insert into public.user_roles (user_id, role) values (_user, 'student') on conflict do nothing;
    insert into public.audit_logs (actor_id, action, entity, entity_id, after)
    values (null, 'user.approved_by_roster', 'profiles', _user, jsonb_build_object('email', lower(_email)));
  end if;
  return n;
end $$;
revoke all on function private.claim_invites(uuid, text) from public;

create function private.on_profile_created_claim() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.claim_invites(new.id, new.email);
  return null;
end $$;
create trigger profiles_claim_invites after insert on public.profiles
  for each row execute function private.on_profile_created_claim();

create function public.import_roster(_course_id uuid, _rows jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb;
  em text;
  invited integer := 0;
  enrolled integer := 0;
  invalid integer := 0;
  uid uuid;
begin
  if not private.is_course_teacher(_course_id) then
    raise exception 'CQ_FORBIDDEN' using errcode = '42501';
  end if;
  if jsonb_typeof(_rows) <> 'array' or jsonb_array_length(_rows) > 500 then
    raise exception 'CQ_INVALID_ROSTER' using errcode = 'check_violation';
  end if;
  for r in select * from jsonb_array_elements(_rows) loop
    em := lower(btrim(r ->> 'email'));
    if em is null or em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      invalid := invalid + 1;
      continue;
    end if;
    insert into public.roster_invites (course_id, email, student_code, display_name, created_by)
    values (_course_id, em, nullif(btrim(r ->> 'student_code'), ''), nullif(btrim(r ->> 'display_name'), ''), (select auth.uid()))
    on conflict (course_id, email) do update
      set student_code = coalesce(excluded.student_code, public.roster_invites.student_code),
          display_name = coalesce(excluded.display_name, public.roster_invites.display_name);
    invited := invited + 1;
    select id into uid from public.profiles where lower(email) = em;
    if uid is not null then
      enrolled := enrolled + private.claim_invites(uid, em);
    end if;
  end loop;
  perform private.write_audit('course.roster_imported', 'courses', _course_id, null,
    jsonb_build_object('invited', invited, 'enrolled_now', enrolled, 'invalid', invalid));
  return jsonb_build_object('invited', invited, 'enrolled_now', enrolled, 'invalid', invalid);
end $$;
revoke all on function public.import_roster(uuid, jsonb) from public, anon;
grant execute on function public.import_roster(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------- gradebook export (scores ≠ XP)
create function public.gradebook_export(_course_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_course_teacher(_course_id) then
    raise exception 'CQ_FORBIDDEN' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(i order by i ->> 'sort') from (
        select jsonb_build_object('id', q.id, 'type', 'quest', 'title', q.title, 'max', q.max_score,
                                  'sort', '1-' || lpad(q.position::text, 5, '0') || q.title) i
          from public.quests q where q.course_id = _course_id and q.published
        union all
        select jsonb_build_object('id', z.id, 'type', 'quiz', 'title', z.title,
                                  'max', (select coalesce(sum(qs.points), 0) from public.quiz_questions qq
                                           join public.questions qs on qs.id = qq.question_id where qq.quiz_id = z.id),
                                  'sort', '2-' || z.created_at::text)
          from public.quizzes z where z.course_id = _course_id and z.published) x), '[]'::jsonb),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', p.id, 'email', p.email, 'display_name', p.display_name, 'student_code', p.student_code,
        'xp', (select coalesce(sum(amount), 0) from public.xp_transactions x where x.user_id = p.id and x.course_id = _course_id),
        'scores', coalesce((
          select jsonb_object_agg(k, v) from (
            -- quest: latest approved review score
            select s.quest_id::text k, to_jsonb(max(rv.score)) v
              from public.quest_submissions s join public.quest_reviews rv on rv.submission_id = s.id
             where s.user_id = p.id and s.course_id = _course_id and s.status = 'approved'
             group by s.quest_id
            union all
            -- quiz: first graded attempt (same rule as the pre/post report)
            (select distinct on (a.quiz_id) a.quiz_id::text, to_jsonb(a.score)
               from public.quiz_attempts a
              where a.user_id = p.id and a.course_id = _course_id and a.status = 'graded'
              order by a.quiz_id, a.attempt_no)) t), '{}'::jsonb))
        order by p.student_code nulls last, p.display_name)
      from public.course_members m join public.profiles p on p.id = m.user_id
     where m.course_id = _course_id and m.member_role = 'student'), '[]'::jsonb));
end $$;
revoke all on function public.gradebook_export(uuid) from public, anon;
grant execute on function public.gradebook_export(uuid) to authenticated;

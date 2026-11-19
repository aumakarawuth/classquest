-- P2-04: lesson completion with server-side prerequisite (unlock) enforcement.

create function private.lesson_visible_to_student(_lesson_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.lessons l
      join public.learning_units u on u.id = l.unit_id
      join public.courses c on c.id = l.course_id
     where l.id = _lesson_id and l.published and u.published and c.status = 'published'
       and private.is_course_member(l.course_id)
  );
$$;
revoke all on function private.lesson_visible_to_student(uuid) from public;

create function public.complete_lesson(_lesson_id uuid)
returns public.lesson_progress
language plpgsql security definer set search_path = '' as $$
declare
  prereq uuid;
  row public.lesson_progress;
begin
  if not private.has_role('student') or not private.lesson_visible_to_student(_lesson_id) then
    raise exception 'CQ_FORBIDDEN' using errcode = '42501';
  end if;

  select prerequisite_lesson_id into prereq from public.lessons where id = _lesson_id;
  if prereq is not null and not exists (
       select 1 from public.lesson_progress
        where lesson_id = prereq and user_id = (select auth.uid()) and status = 'completed') then
    raise exception 'CQ_LOCKED: prerequisite lesson not completed' using errcode = 'check_violation';
  end if;

  insert into public.lesson_progress (lesson_id, user_id, status, completed_at)
  values (_lesson_id, (select auth.uid()), 'completed', now())
  on conflict (lesson_id, user_id) do update
     set status = 'completed',
         completed_at = coalesce(public.lesson_progress.completed_at, excluded.completed_at)
  returning * into row;
  -- XP for lesson completion is awarded by the gamification engine (Phase 3), not here.
  return row;
end $$;

revoke all on function public.complete_lesson(uuid) from public, anon;
grant execute on function public.complete_lesson(uuid) to authenticated;

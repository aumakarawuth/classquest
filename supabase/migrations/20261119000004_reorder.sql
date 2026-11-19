-- P2-03: atomic reordering for the course builder. SECURITY INVOKER: RLS (course teacher) still applies,
-- so a non-teacher sees no rows and fails the completeness check.

create function public.reorder_lessons(_unit_id uuid, _lesson_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if (select count(*) from public.lessons where unit_id = _unit_id) <> cardinality(_lesson_ids)
     or exists (select 1 from unnest(_lesson_ids) i where not exists
                (select 1 from public.lessons l where l.id = i and l.unit_id = _unit_id)) then
    raise exception 'CQ_INVALID_ORDER' using errcode = 'check_violation';
  end if;
  set constraints all deferred;
  update public.lessons l set position = o.ord
    from unnest(_lesson_ids) with ordinality as o(id, ord)
   where l.id = o.id and l.position is distinct from o.ord;
end $$;

create function public.reorder_resources(_lesson_id uuid, _resource_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if (select count(*) from public.lesson_resources where lesson_id = _lesson_id) <> cardinality(_resource_ids)
     or exists (select 1 from unnest(_resource_ids) i where not exists
                (select 1 from public.lesson_resources r where r.id = i and r.lesson_id = _lesson_id)) then
    raise exception 'CQ_INVALID_ORDER' using errcode = 'check_violation';
  end if;
  update public.lesson_resources r set position = o.ord
    from unnest(_resource_ids) with ordinality as o(id, ord)
   where r.id = o.id and r.position is distinct from o.ord;
end $$;

revoke all on function public.reorder_lessons(uuid, uuid[]) from public, anon;
revoke all on function public.reorder_resources(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_lessons(uuid, uuid[]) to authenticated;
grant execute on function public.reorder_resources(uuid, uuid[]) to authenticated;

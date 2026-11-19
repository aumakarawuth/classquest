-- Behavioural checks for 20261119000001_core.sql. Each block raises on failure.
\set ON_ERROR_STOP on
begin;

-- fixtures (as superuser)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@school.test', '{"full_name":"Admin"}'),
  ('00000000-0000-0000-0000-00000000000b', 'teacher@school.test', '{"full_name":"Teacher","role":"admin"}'),
  ('00000000-0000-0000-0000-00000000000c', 'student@school.test', '{}'),
  ('00000000-0000-0000-0000-00000000000d', 'other@school.test', '{}');

do $$ begin
  assert (select count(*) from public.profiles where status = 'pending') = 4, 'new users must be pending';
  assert (select count(*) from public.user_roles) = 0, 'metadata must never grant a role';
end $$;

update public.profiles set status = 'active';
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin'),
  ('00000000-0000-0000-0000-00000000000b', 'teacher'),
  ('00000000-0000-0000-0000-00000000000c', 'student'),
  ('00000000-0000-0000-0000-00000000000d', 'student');

-- teacher creates a course
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into public.courses (id, code, name, level, term, academic_year, created_by)
values ('00000000-0000-0000-0000-0000000000c1', '31910-2012', 'IoT', 'pvs', 1, 2569,
        '00000000-0000-0000-0000-00000000000b');
do $$ begin
  assert (select count(*) from public.course_members where member_role = 'teacher') = 1,
    'creator must become teacher member';
end $$;
insert into public.course_members (course_id, user_id, member_role)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000c', 'student');

-- student: sees own course, cannot escalate
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  assert (select count(*) from public.courses) = 1, 'member sees course';
  assert (select count(*) from public.audit_logs) = 0, 'student cannot read audit';
  assert (select count(*) from public.profiles) = 1, 'student sees only own profile';
end $$;
do $$ begin
  begin
    insert into public.user_roles (user_id, role) values (auth.uid(), 'admin');
    raise exception 'FAIL: student granted self a role';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set status = 'active' where id = auth.uid();
    raise exception 'FAIL: student changed own status';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.courses (code, name, level, term, academic_year, created_by)
    values ('X', 'X', 'pvc', 1, 2569, auth.uid());
    raise exception 'FAIL: student created a course';
  exception when insufficient_privilege then null; end;
end $$;
update public.profiles set nickname = 'Neo' where id = auth.uid();
do $$ begin
  assert (select nickname from public.profiles where id = auth.uid()) = 'Neo', 'self edit nickname';
end $$;

-- non-member student sees nothing
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
do $$ begin
  assert (select count(*) from public.courses) = 0, 'non-member must not see course';
  assert (select count(*) from public.course_members) = 0, 'non-member must not see roster';
end $$;

-- teacher sees roster profiles of own course only
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  assert (select count(*) from public.profiles) = 2, 'teacher sees self + own student';
end $$;

-- anon sees nothing
reset role;
set local role anon;
do $$ begin
  begin
    perform 1 from public.courses;
    raise exception 'FAIL: anon read courses';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- domain restriction
update public.system_settings set value = '["school.test"]' where key = 'auth.allowed_email_domains';
do $$ begin
  begin
    insert into auth.users (email) values ('someone@gmail.com');
    raise exception 'FAIL: outside domain accepted';
  exception when check_violation then null; end;
end $$;
insert into auth.users (email) values ('new@SCHOOL.test');

select 'ALL CORE TESTS PASSED' as result;
rollback;

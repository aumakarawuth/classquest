begin;
select plan(6);

select tests.create_user('a2000000-0000-0000-0000-00000000000a', 't@school.test', 'active', 'teacher');
select tests.create_user('a2000000-0000-0000-0000-00000000000b', 's@school.test', 'active', 'student');
select tests.act_as('a2000000-0000-0000-0000-00000000000a');
insert into public.courses (id, code, name, level, term, academic_year, created_by, weeks, status)
values ('a2c00000-0000-0000-0000-000000000001', 'VL', 'Lab', 'pvc', 1, 2569, 'a2000000-0000-0000-0000-00000000000a', 1, 'published'),
       ('a2c00000-0000-0000-0000-000000000002', 'VL2', 'Other', 'pvc', 1, 2569, 'a2000000-0000-0000-0000-00000000000a', 1, 'published');
insert into public.course_members (course_id, user_id, member_role)
values ('a2c00000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-00000000000b', 'student');
insert into public.quests (id, course_id, title, published) values
  ('a2a00000-0000-0000-0000-000000000002', 'a2c00000-0000-0000-0000-000000000002', 'Other quest', true);

select lives_ok($$ insert into public.virtual_labs (course_id, title, project_url, published, components)
  values ('a2c00000-0000-0000-0000-000000000001', 'LED Blink', 'https://wokwi.com/projects/322062421191557714', true, array['Arduino','LED']) $$,
  'teacher creates a Wokwi lab');
insert into public.virtual_labs (course_id, title, project_url) values
  ('a2c00000-0000-0000-0000-000000000001', 'Draft', 'https://wokwi.com/projects/1');
select throws_ok($$ insert into public.virtual_labs (course_id, title, project_url)
  values ('a2c00000-0000-0000-0000-000000000001', 'X', 'https://evil.example/projects/1') $$, '23514', null, 'only wokwi.com project URLs');
select throws_ok($$ insert into public.virtual_labs (course_id, title, project_url, quest_id)
  values ('a2c00000-0000-0000-0000-000000000001', 'X', 'https://wokwi.com/projects/2', 'a2a00000-0000-0000-0000-000000000002') $$,
  '23514', null, 'evidence quest must belong to the same course');

select tests.act_as('a2000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.virtual_labs), 1, 'student sees only published labs of enrolled courses');
select throws_ok($$ insert into public.virtual_labs (course_id, title, project_url)
  values ('a2c00000-0000-0000-0000-000000000001', 'X', 'https://wokwi.com/projects/3') $$, '42501', null, 'student cannot create labs');
select is_empty($$ update public.virtual_labs set title = 'hacked' returning id $$, 'student cannot edit labs');

select * from finish(true);
rollback;

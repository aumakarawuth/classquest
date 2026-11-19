begin;
select plan(20);

select tests.create_user('50000000-0000-0000-0000-00000000000a', 't@school.test', 'active', 'teacher');
select tests.create_user('50000000-0000-0000-0000-00000000000b', 's@school.test', 'active', 'student');
select tests.create_user('50000000-0000-0000-0000-00000000000c', 's2@school.test', 'active', 'student');
select tests.create_user('50000000-0000-0000-0000-00000000000d', 't2@school.test', 'active', 'teacher');

select tests.act_as('50000000-0000-0000-0000-00000000000a');
insert into public.courses (id, code, name, level, term, academic_year, created_by, status)
values ('5c000000-0000-0000-0000-000000000001', '31910-2012', 'IoT', 'pvs', 1, 2569,
        '50000000-0000-0000-0000-00000000000a', 'published');
select is((select count(*)::int from public.learning_units where course_id = '5c000000-0000-0000-0000-000000000001'),
  18, 'new course gets 18 weekly units');

update public.learning_units set published = true
 where course_id = '5c000000-0000-0000-0000-000000000001' and position = 1;
insert into public.lessons (id, unit_id, position, title, published, quest_stage)
select '5e000000-0000-0000-0000-000000000001', id, 1, 'What is IoT', true, 'question'
  from public.learning_units where course_id = '5c000000-0000-0000-0000-000000000001' and position = 1;
insert into public.lessons (id, unit_id, position, title, published, prerequisite_lesson_id)
select '5e000000-0000-0000-0000-000000000002', id, 2, 'Draft lesson', false, '5e000000-0000-0000-0000-000000000001'
  from public.learning_units where course_id = '5c000000-0000-0000-0000-000000000001' and position = 1;
select is((select course_id from public.lessons where id = '5e000000-0000-0000-0000-000000000001'),
  '5c000000-0000-0000-0000-000000000001'::uuid, 'lesson course_id derived from unit');
insert into public.lesson_resources (lesson_id, position, type, url)
values ('5e000000-0000-0000-0000-000000000001', 1, 'youtube', 'https://www.youtube.com/watch?v=x');
select throws_ok($$ insert into public.lesson_resources (lesson_id, position, type, url)
  values ('5e000000-0000-0000-0000-000000000001', 2, 'external', 'javascript:alert(1)') $$,
  '23514', null, 'non-https resource URL rejected');

-- enrollment code is server-generated
select throws_ok($$ insert into public.enrollment_codes (course_id, code, created_by)
  values ('5c000000-0000-0000-0000-000000000001', 'ABCDEFGH', '50000000-0000-0000-0000-00000000000a') $$,
  '42501', null, 'codes cannot be inserted directly');
create temporary table t_code on commit drop as
  select * from public.create_enrollment_code('5c000000-0000-0000-0000-000000000001', null, 1);
grant select on t_code to authenticated;
select matches((select code from t_code), '^[A-HJ-NP-Z2-9]{8}$', 'code is 8 unambiguous characters');

-- other teacher cannot create a code for this course
select tests.act_as('50000000-0000-0000-0000-00000000000d');
select throws_ok($$ select public.create_enrollment_code('5c000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'non-teaching teacher cannot create codes');

-- student joins
select tests.act_as('50000000-0000-0000-0000-00000000000b');
select is_empty($$ select * from public.lessons $$, 'non-member sees no lessons');
select throws_ok($$ select public.join_course_by_code('WRONG123') $$, '23514', null, 'invalid code rejected');
select is(public.join_course_by_code(lower((select code from t_code))),
  '5c000000-0000-0000-0000-000000000001'::uuid, 'student joins with code (case-insensitive)');
select lives_ok($$ select public.join_course_by_code((select code from t_code)) $$,
  're-joining is idempotent (does not consume another use)');
select is((select count(*)::int from public.lessons), 1, 'student sees only published lesson in published unit');
select is((select count(*)::int from public.learning_units), 1, 'student sees only published units');
select is((select count(*)::int from public.lesson_resources), 1, 'student sees resources of visible lessons');
select throws_ok($$ insert into public.lesson_progress (lesson_id, user_id)
  values ('5e000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000b') $$,
  '42501', null, 'student cannot write progress directly');
select is_empty($$ update public.lessons set title = 'x' returning id $$, 'student cannot edit lessons');

-- max_uses enforced
select tests.act_as('50000000-0000-0000-0000-00000000000c');
select throws_ok($$ select public.join_course_by_code((select code from t_code)) $$,
  '23514', null, 'code with max_uses=1 is exhausted');

-- clone copies content, not students
select tests.act_as('50000000-0000-0000-0000-00000000000a');
create temporary table t_clone on commit drop as
  select public.clone_course('5c000000-0000-0000-0000-000000000001', 2::smallint, 2569::smallint, '') as id;
select is((select status::text from public.courses where id = (select id from t_clone)), 'draft', 'clone is draft');
select is((select count(*)::int from public.learning_units where course_id = (select id from t_clone)), 18,
  'clone copies units (no duplicate defaults)');
select is((select count(*)::int from public.lessons l
           where l.course_id = (select id from t_clone) and l.prerequisite_lesson_id is not null
             and exists (select 1 from public.lessons p where p.id = l.prerequisite_lesson_id
                         and p.course_id = (select id from t_clone))), 1, 'prerequisites remapped to cloned lessons');
select is((select count(*)::int from public.course_members where course_id = (select id from t_clone)), 1,
  'clone has only the teacher, no students');

select * from finish(true);
rollback;

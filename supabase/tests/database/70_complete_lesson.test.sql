begin;
select plan(8);

select tests.create_user('70000000-0000-0000-0000-00000000000a', 't@school.test', 'active', 'teacher');
select tests.create_user('70000000-0000-0000-0000-00000000000b', 's@school.test', 'active', 'student');
select tests.create_user('70000000-0000-0000-0000-00000000000c', 'out@school.test', 'active', 'student');

select tests.act_as('70000000-0000-0000-0000-00000000000a');
insert into public.courses (id, code, name, level, term, academic_year, created_by, weeks, status)
values ('7c000000-0000-0000-0000-000000000001', 'CL', 'Complete', 'pvc', 1, 2569,
        '70000000-0000-0000-0000-00000000000a', 1, 'published');
update public.learning_units set published = true where course_id = '7c000000-0000-0000-0000-000000000001';
insert into public.lessons (id, unit_id, position, title, published, prerequisite_lesson_id)
select v.id, u.id, v.pos, v.t, v.pub, v.pre from public.learning_units u,
  (values ('7e000000-0000-0000-0000-000000000001'::uuid, 1, 'L1', true, null::uuid),
          ('7e000000-0000-0000-0000-000000000002'::uuid, 2, 'L2', true, '7e000000-0000-0000-0000-000000000001'::uuid),
          ('7e000000-0000-0000-0000-000000000003'::uuid, 3, 'Draft', false, null::uuid)) v(id, pos, t, pub, pre)
 where u.course_id = '7c000000-0000-0000-0000-000000000001';
insert into public.course_members (course_id, user_id, member_role)
values ('7c000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-00000000000b', 'student');

select tests.act_as('70000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.complete_lesson('7e000000-0000-0000-0000-000000000002') $$,
  '23514', null, 'locked lesson cannot be completed before its prerequisite');
select throws_ok($$ select public.complete_lesson('7e000000-0000-0000-0000-000000000003') $$,
  '42501', null, 'unpublished lesson cannot be completed');
select is((public.complete_lesson('7e000000-0000-0000-0000-000000000001')).status::text, 'completed',
  'student completes first lesson');
select lives_ok($$ select public.complete_lesson('7e000000-0000-0000-0000-000000000001') $$,
  'completing again is idempotent');
select is((select count(*)::int from public.lesson_progress), 1, 'still a single progress row');
select lives_ok($$ select public.complete_lesson('7e000000-0000-0000-0000-000000000002') $$,
  'second lesson unlocks after prerequisite');

select tests.act_as('70000000-0000-0000-0000-00000000000c');
select throws_ok($$ select public.complete_lesson('7e000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'non-member cannot complete lessons');
select is_empty($$ select * from public.lesson_progress $$, 'non-member cannot see others progress');

select * from finish(true);
rollback;

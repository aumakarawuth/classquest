begin;
select plan(11);

select tests.create_user('a0000000-0000-0000-0000-00000000000a', 't@school.test', 'active', 'teacher');
select tests.create_user('a0000000-0000-0000-0000-00000000000b', 's@school.test', 'active', 'student');
select tests.create_user('a0000000-0000-0000-0000-00000000000c', 'out@school.test', 'active', 'student');
select tests.act_as('a0000000-0000-0000-0000-00000000000a');
insert into public.courses (id, code, name, level, term, academic_year, created_by, weeks, status)
values ('ac000000-0000-0000-0000-000000000001', 'LV', 'Levels', 'pvc', 1, 2569, 'a0000000-0000-0000-0000-00000000000a', 1, 'published');
update public.learning_units set published = true where course_id = 'ac000000-0000-0000-0000-000000000001';
insert into public.lessons (id, unit_id, position, title, published)
select 'ae000000-0000-0000-0000-000000000001', id, 1, 'L1', true from public.learning_units
 where course_id = 'ac000000-0000-0000-0000-000000000001';
insert into public.course_members (course_id, user_id, member_role)
values ('ac000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000b', 'student');

select tests.act_as('a0000000-0000-0000-0000-00000000000b');
select results_eq($$ select xp, level::int, next_threshold from public.my_course_progress('ac000000-0000-0000-0000-000000000001') $$,
  $$ values (0, 1, 100) $$, 'new student: 0 XP, level 1, next at 100 (global ladder)');
select public.complete_lesson('ae000000-0000-0000-0000-000000000001');
select public.complete_lesson('ae000000-0000-0000-0000-000000000001');
select is((select xp from public.my_course_progress('ac000000-0000-0000-0000-000000000001')), 10,
  'lesson completion gives XP exactly once');
select throws_ok($$ select public.save_course_levels('ac000000-0000-0000-0000-000000000001', '[]') $$, '42501', null,
  'student cannot edit levels');
select throws_ok($$ insert into public.level_definitions (course_id, level, xp_threshold) values (null, 11, 0) $$, '42501', null,
  'student cannot edit global ladder');

select tests.act_as('a0000000-0000-0000-0000-00000000000a');
select throws_ok($$ select public.save_course_levels('ac000000-0000-0000-0000-000000000001',
  '[{"xp_threshold":0},{"xp_threshold":50},{"xp_threshold":40}]') $$, '23514', null, 'thresholds must increase');
select throws_ok($$ select public.save_course_levels('ac000000-0000-0000-0000-000000000001', '[{"xp_threshold":5}]') $$,
  '23514', null, 'ladder must start at 0');
select lives_ok($$ select public.save_course_levels('ac000000-0000-0000-0000-000000000001',
  '[{"xp_threshold":0,"title":"มือใหม่"},{"xp_threshold":5,"title":"นักทดลอง"},{"xp_threshold":20}]') $$,
  'teacher saves course ladder');

select tests.act_as('a0000000-0000-0000-0000-00000000000b');
select results_eq($$ select level::int, level_title, level_floor, next_threshold from public.my_course_progress('ac000000-0000-0000-0000-000000000001') $$,
  $$ values (2, 'นักทดลอง'::text, 5, 20) $$, 'course ladder overrides global; level recomputed from ledger');

select tests.act_as('a0000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.save_course_levels('ac000000-0000-0000-0000-000000000001', '[]') $$, 'reset to global');
select tests.act_as('a0000000-0000-0000-0000-00000000000b');
select is((select level::int from public.my_course_progress('ac000000-0000-0000-0000-000000000001')), 1, 'global ladder again');

select tests.act_as('a0000000-0000-0000-0000-00000000000c');
select is_empty($$ select * from public.my_course_progress('ac000000-0000-0000-0000-000000000001') $$,
  'non-member gets no progress row');

select * from finish(true);
rollback;

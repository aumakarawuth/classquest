begin;
select plan(5);

select tests.create_user('60000000-0000-0000-0000-00000000000a', 't@school.test', 'active', 'teacher');
select tests.create_user('60000000-0000-0000-0000-00000000000b', 's@school.test', 'active', 'student');
select tests.act_as('60000000-0000-0000-0000-00000000000a');
insert into public.courses (id, code, name, level, term, academic_year, created_by, weeks)
values ('6c000000-0000-0000-0000-000000000001', 'R1', 'Reorder', 'pvc', 1, 2569, '60000000-0000-0000-0000-00000000000a', 1);
insert into public.lessons (id, unit_id, position, title)
select v.id, u.id, v.pos, v.t from public.learning_units u,
  (values ('6e000000-0000-0000-0000-000000000001'::uuid, 1, 'A'),
          ('6e000000-0000-0000-0000-000000000002'::uuid, 2, 'B'),
          ('6e000000-0000-0000-0000-000000000003'::uuid, 3, 'C')) v(id, pos, t)
 where u.course_id = '6c000000-0000-0000-0000-000000000001';
create temporary table t_unit on commit drop as
  select id from public.learning_units where course_id = '6c000000-0000-0000-0000-000000000001';
grant select on t_unit to authenticated;

select lives_ok($$ select public.reorder_lessons((select id from t_unit),
  array['6e000000-0000-0000-0000-000000000003','6e000000-0000-0000-0000-000000000001','6e000000-0000-0000-0000-000000000002']::uuid[]) $$,
  'teacher reorders lessons atomically (swapping unique positions)');
select results_eq($$ select title from public.lessons where unit_id = (select id from t_unit) order by position $$,
  $$ values ('C'), ('A'), ('B') $$, 'new order persisted');
select throws_ok($$ select public.reorder_lessons((select id from t_unit),
  array['6e000000-0000-0000-0000-000000000001']::uuid[]) $$, '23514', null, 'partial list rejected');

select tests.act_as('60000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.reorder_lessons((select id from t_unit),
  array['6e000000-0000-0000-0000-000000000001','6e000000-0000-0000-0000-000000000002','6e000000-0000-0000-0000-000000000003']::uuid[]) $$,
  '23514', null, 'student cannot reorder (sees no lessons)');
select tests.reset_actor();
select results_eq($$ select title from public.lessons where unit_id = (select id from t_unit) order by position $$,
  $$ values ('C'), ('A'), ('B') $$, 'order unchanged after student attempt');

select * from finish(true);
rollback;

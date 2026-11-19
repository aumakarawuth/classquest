begin;
select plan(18);

select tests.create_user('90000000-0000-0000-0000-00000000000a', 't@school.test', 'active', 'teacher');
select tests.create_user('90000000-0000-0000-0000-00000000000b', 's@school.test', 'active', 'student');
select tests.create_user('90000000-0000-0000-0000-00000000000d', 't2@school.test', 'active', 'teacher');

select tests.act_as('90000000-0000-0000-0000-00000000000a');
insert into public.courses (id, code, name, level, term, academic_year, created_by, weeks, status)
values ('9c000000-0000-0000-0000-000000000001', 'RV', 'Review', 'pvc', 1, 2569, '90000000-0000-0000-0000-00000000000a', 1, 'published');
insert into public.course_members (course_id, user_id, member_role)
values ('9c000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-00000000000b', 'student');
insert into public.quests (id, course_id, title, published, max_score, xp_reward, max_attempts) values
  ('9a000000-0000-0000-0000-000000000001', '9c000000-0000-0000-0000-000000000001', 'Rubric quest', true, 20, 150, 3),
  ('9a000000-0000-0000-0000-000000000002', '9c000000-0000-0000-0000-000000000001', 'Plain quest', true, 10, 50, 3);
select isnt(public.save_quest_rubric('9a000000-0000-0000-0000-000000000001',
  '[{"name":"วงจรถูกต้อง","max_points":4},{"name":"โค้ดทำงาน","max_points":4}]'), null, 'teacher saves rubric');
select is((select count(*)::int from public.rubric_criteria), 2, 'two criteria');

select tests.act_as('90000000-0000-0000-0000-00000000000b');
create temporary table t_sub on commit drop as
  select (public.submit_quest('9a000000-0000-0000-0000-000000000001', 'v1')).id as id;
grant select on t_sub to authenticated;
select throws_ok($$ select public.review_submission((select id from t_sub), 'approved', 10, '', null, 'student-key-1') $$,
  '42501', null, 'student cannot review');
select throws_ok($$ select public.save_quest_rubric('9a000000-0000-0000-0000-000000000001', '[]') $$,
  '42501', null, 'student cannot edit rubric');

select tests.act_as('90000000-0000-0000-0000-00000000000d');
select throws_ok($$ select public.review_submission((select id from t_sub), 'approved', 10, '', null, 'other-teacher') $$,
  '42501', null, 'teacher of another course cannot review');

select tests.act_as('90000000-0000-0000-0000-00000000000a');
create temporary table t_crit on commit drop as select id, position from public.rubric_criteria order by position;
select throws_ok($$ select public.review_submission((select id from t_sub), 'approved', null, '',
  jsonb_build_array(jsonb_build_object('criterion_id', (select id from t_crit where position = 1), 'points', 9)), 'bad-rubric-1') $$,
  '23514', null, 'points above criterion max / missing criterion rejected');

-- needs revision first
select is((public.review_submission((select id from t_sub), 'needs_revision', null, 'เพิ่มภาพวงจร', null, 'rev-key-0001')).decision::text,
  'needs_revision', 'teacher requests revision');
select is((select count(*)::int from public.xp_transactions), 0, 'no XP for revision');
select throws_ok($$ select public.review_submission((select id from t_sub), 'approved', 10, '', null, 'rev-key-0002') $$,
  '23514', null, 'a reviewed submission cannot be reviewed again');

select tests.act_as('90000000-0000-0000-0000-00000000000b');
create temporary table t_sub2 on commit drop as
  select (public.submit_quest('9a000000-0000-0000-0000-000000000001', 'v2')).id as id;
grant select on t_sub2 to authenticated;
select is((select feedback from public.quest_reviews), 'เพิ่มภาพวงจร', 'student reads own feedback');

select tests.act_as('90000000-0000-0000-0000-00000000000a');
select is((public.review_submission((select id from t_sub2), 'approved', null, 'ดีมาก',
  jsonb_build_array(
    jsonb_build_object('criterion_id', (select id from t_crit where position = 1), 'points', 4),
    jsonb_build_object('criterion_id', (select id from t_crit where position = 2), 'points', 3)), 'approve-key-01')).score,
  17.50::numeric, 'rubric 7/8 scaled to 17.5/20');
select is((select sum(amount)::int from public.xp_transactions), 150, 'XP awarded once on approval');
select lives_ok($$ select public.review_submission((select id from t_sub2), 'approved', null, 'ดีมาก', '[]', 'approve-key-01') $$,
  'retry with same idempotency key is a no-op');
select is((select count(*)::int from public.xp_transactions), 1, 'retry does not duplicate XP');

-- plain quest: score required and bounded
select tests.act_as('90000000-0000-0000-0000-00000000000b');
create temporary table t_sub3 on commit drop as
  select (public.submit_quest('9a000000-0000-0000-0000-000000000002', 'x')).id as id;
grant select on t_sub3 to authenticated;
select throws_ok($$ insert into public.xp_transactions (user_id, course_id, amount, source_type, source_id, reason)
  values ('90000000-0000-0000-0000-00000000000b', '9c000000-0000-0000-0000-000000000001', 9999, 'manual',
          '9c000000-0000-0000-0000-000000000001', 'hack') $$, '42501', null, 'student cannot write XP');
select tests.act_as('90000000-0000-0000-0000-00000000000a');
select throws_ok($$ select public.review_submission((select id from t_sub3), 'approved', 11, '', null, 'plain-key-01') $$,
  '23514', null, 'score above max rejected');

-- clone copies quests + rubric, not submissions or XP
create temporary table t_clone on commit drop as
  select public.clone_course('9c000000-0000-0000-0000-000000000001', 2::smallint, 2569::smallint, '') as id;
select is((select count(*)::int from public.quests where course_id = (select id from t_clone) and rubric_id is not null
           and not published), 1, 'clone copies quests (unpublished) with rubric');
select is((select count(*)::int from public.quest_submissions where course_id = (select id from t_clone)), 0,
  'clone copies no submissions');

select * from finish(true);
rollback;

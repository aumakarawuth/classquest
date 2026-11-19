begin;
select plan(13);

select tests.create_user('d0000000-0000-0000-0000-00000000000a', 't@school.test', 'active', 'teacher');
select tests.create_user('d0000000-0000-0000-0000-00000000000b', 's1@school.test', 'active', 'student');
select tests.create_user('d0000000-0000-0000-0000-00000000000c', 's2@school.test', 'active', 'student');
update public.badges set active = false;

select tests.act_as('d0000000-0000-0000-0000-00000000000a');
insert into public.courses (id, code, name, level, term, academic_year, created_by, weeks, status)
values ('dc000000-0000-0000-0000-000000000001', 'CP', 'Comp', 'pvs', 1, 2569, 'd0000000-0000-0000-0000-00000000000a', 1, 'published');
insert into public.course_members (course_id, user_id, member_role) values
  ('dc000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-00000000000b', 'student'),
  ('dc000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-00000000000c', 'student');
insert into public.competencies (id, course_id, code, name, pass_threshold, position) values
  ('dd000000-0000-0000-0000-000000000001', 'dc000000-0000-0000-0000-000000000001', 'C1', 'ต่อวงจรอิเล็กทรอนิกส์', 60, 1),
  ('dd000000-0000-0000-0000-000000000002', 'dc000000-0000-0000-0000-000000000001', 'C2', 'เขียนโปรแกรมไมโครคอนโทรลเลอร์', 70, 2),
  ('dd000000-0000-0000-0000-000000000003', 'dc000000-0000-0000-0000-000000000001', 'C3', 'สื่อสารเครือข่าย', 60, 3);
insert into public.quests (id, course_id, title, published, max_score) values
  ('da000000-0000-0000-0000-000000000001', 'dc000000-0000-0000-0000-000000000001', 'Rubric', true, 10),
  ('da000000-0000-0000-0000-000000000002', 'dc000000-0000-0000-0000-000000000001', 'Mapped', true, 20);
select lives_ok($$ select public.save_quest_rubric('da000000-0000-0000-0000-000000000001', jsonb_build_array(
  jsonb_build_object('name', 'วงจร', 'max_points', 4, 'competency_id', 'dd000000-0000-0000-0000-000000000001'),
  jsonb_build_object('name', 'โค้ด', 'max_points', 4, 'competency_id', 'dd000000-0000-0000-0000-000000000002'))) $$,
  'rubric criteria linked to competencies');
insert into public.competency_mappings (competency_id, course_id, target_type, target_id) values
  ('dd000000-0000-0000-0000-000000000003', 'dc000000-0000-0000-0000-000000000001', 'quest', 'da000000-0000-0000-0000-000000000002');
select throws_ok($$ insert into public.competencies (course_id, code, name, parent_id) values
  ('dc000000-0000-0000-0000-000000000001', 'X', 'x', gen_random_uuid()) $$, '23514', null, 'parent must be in same course');

select tests.act_as('d0000000-0000-0000-0000-00000000000b');
create temporary table t_s on commit drop as select
  (public.submit_quest('da000000-0000-0000-0000-000000000001', 'a')).id as r,
  (public.submit_quest('da000000-0000-0000-0000-000000000002', 'b')).id as m;
grant select on t_s to authenticated;
select throws_ok($$ insert into public.competency_results (competency_id, course_id, user_id, score_percent, source_type, source_id)
  values ('dd000000-0000-0000-0000-000000000001', 'dc000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-00000000000b',
          100, 'manual', gen_random_uuid()) $$, '42501', null, 'student cannot write competency results');
select throws_ok($$ select public.record_competency_result('dd000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-00000000000b', 100, '') $$,
  '42501', null, 'student cannot self-assess');

select tests.act_as('d0000000-0000-0000-0000-00000000000a');
create temporary table t_c on commit drop as select id, position from public.rubric_criteria order by position;
select public.review_submission((select r from t_s), 'approved', null, '', jsonb_build_array(
  jsonb_build_object('criterion_id', (select id from t_c where position = 1), 'points', 4),
  jsonb_build_object('criterion_id', (select id from t_c where position = 2), 'points', 2)), 'comp-review-1');
select public.review_submission((select m from t_s), 'approved', 10, '', null, 'comp-review-2');

select results_eq($$ select competency_id::text, score_percent, passed from public.competency_matrix('dc000000-0000-0000-0000-000000000001')
   where user_id = 'd0000000-0000-0000-0000-00000000000b' order by competency_id $$,
  $$ values ('dd000000-0000-0000-0000-000000000001', 100.00::numeric, true),
            ('dd000000-0000-0000-0000-000000000002', 50.00::numeric, false),
            ('dd000000-0000-0000-0000-000000000003', 50.00::numeric, false) $$,
  'rubric criterion → competency %, quest mapping → score %, thresholds applied');
select is((select count(*)::int from public.competency_matrix('dc000000-0000-0000-0000-000000000001')
            where user_id = 'd0000000-0000-0000-0000-00000000000c' and score_percent is null), 3,
  'student without evidence: not yet assessed (null), not failed');

select lives_ok($$ select public.record_competency_result('dd000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-00000000000b', 80, 'สอบปฏิบัติซ้ำ') $$,
  'teacher records practical assessment');
select is((select passed from public.competency_matrix('dc000000-0000-0000-0000-000000000001')
            where user_id = 'd0000000-0000-0000-0000-00000000000b' and competency_id = 'dd000000-0000-0000-0000-000000000002'), true,
  'latest evidence decides the status');
select is((select evidence_count from public.competency_matrix('dc000000-0000-0000-0000-000000000001')
            where user_id = 'd0000000-0000-0000-0000-00000000000b' and competency_id = 'dd000000-0000-0000-0000-000000000002'), 2,
  'evidence history kept');
select throws_ok($$ select public.record_competency_result('dd000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-00000000000b', 120, '') $$,
  '23514', null, 'score must be 0–100');

select tests.act_as('d0000000-0000-0000-0000-00000000000b');
select is((select count(distinct user_id)::int from public.competency_matrix('dc000000-0000-0000-0000-000000000001')), 1,
  'student sees only own row in the matrix');
select is((select count(*)::int from public.competency_results where user_id <> 'd0000000-0000-0000-0000-00000000000b'), 0,
  'student cannot read other students'' results');
select is((select count(*)::int from public.competencies), 3, 'student can read the competency framework');

select * from finish(true);
rollback;

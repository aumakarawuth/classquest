begin;
select plan(20);

select tests.create_user('f0000000-0000-0000-0000-00000000000a', 't@school.test', 'active', 'teacher');
select tests.create_user('f0000000-0000-0000-0000-00000000000b', 's@school.test', 'active', 'student');
select tests.create_user('f0000000-0000-0000-0000-00000000000c', 's2@school.test', 'active', 'student');
update public.badges set active = false;
select tests.act_as('f0000000-0000-0000-0000-00000000000a');
insert into public.courses (id, code, name, level, term, academic_year, created_by, weeks, status)
values ('fc000000-0000-0000-0000-000000000001', 'AT', 'Attempts', 'pvc', 1, 2569, 'f0000000-0000-0000-0000-00000000000a', 1, 'published');
insert into public.course_members (course_id, user_id, member_role) values
  ('fc000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000000b', 'student'),
  ('fc000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000000c', 'student');
insert into public.competencies (id, course_id, code, name) values
  ('fd000000-0000-0000-0000-000000000001', 'fc000000-0000-0000-0000-000000000001', 'C1', 'พื้นฐาน IoT');
create temporary table t_q on commit drop as select
  public.save_question(null, 'fc000000-0000-0000-0000-000000000001',
    '{"type":"mc","stem":"MC","points":2,"competency_id":"fd000000-0000-0000-0000-000000000001","options":[{"label":"right","is_correct":true},{"label":"wrong"},{"label":"wrong2"}]}') as mc,
  public.save_question(null, 'fc000000-0000-0000-0000-000000000001',
    '{"type":"short","stem":"auto","points":1,"options":[{"label":"Internet of Things","is_correct":true}]}') as sa,
  public.save_question(null, 'fc000000-0000-0000-0000-000000000001',
    '{"type":"short","stem":"manual","points":3,"options":[]}') as sm;
grant select on t_q to authenticated;
insert into public.quizzes (id, course_id, kind, title, published, max_attempts, xp_reward, passing_percent, answers_visible_at, time_limit_minutes)
values ('fe000000-0000-0000-0000-000000000001', 'fc000000-0000-0000-0000-000000000001', 'pretest', 'Pre', true, 1, 40, 50, now() + interval '1 day', 30);
select public.set_quiz_questions('fe000000-0000-0000-0000-000000000001', array[(select mc from t_q), (select sa from t_q), (select sm from t_q)]);

select tests.act_as('f0000000-0000-0000-0000-00000000000b');
create temporary table t_a on commit drop as select public.start_quiz_attempt('fe000000-0000-0000-0000-000000000001') as p;
grant select on t_a to authenticated;
select is(jsonb_array_length((select p -> 'questions' from t_a)), 3, 'attempt has 3 questions');
select ok((select p::text from t_a) !~ 'is_correct|explanation|right"[^}]*true', 'payload carries no answers');
select ok((select (p ->> 'deadline_at') is not null from t_a), 'time limit sets a deadline');
select is((public.start_quiz_attempt('fe000000-0000-0000-0000-000000000001') ->> 'attempt_id'), (select p ->> 'attempt_id' from t_a),
  'starting again resumes the same attempt');
select throws_ok($$ select public.get_attempt_result(((select p ->> 'attempt_id' from t_a))::uuid) $$, '23514', null,
  'no result before submitting');

-- forged option id from another question must not score
create temporary table t_ans on commit drop as select jsonb_build_array(
  jsonb_build_object('question_id', (select mc from t_q),
    'option_id', (select id from public.question_options where question_id = (select sa from t_q) limit 1)),
  jsonb_build_object('question_id', (select sa from t_q), 'text', '  internet   OF things '),
  jsonb_build_object('question_id', (select sm from t_q), 'text', 'อธิบายยาว ๆ')) as j;
grant select on t_ans to authenticated;

select tests.act_as('f0000000-0000-0000-0000-00000000000c');
select throws_ok($$ select public.submit_quiz_attempt(((select p ->> 'attempt_id' from t_a))::uuid, '[]') $$, '42501', null,
  'cannot submit someone else''s attempt');

select tests.act_as('f0000000-0000-0000-0000-00000000000b');
select is(public.submit_quiz_attempt(((select p ->> 'attempt_id' from t_a))::uuid, (select j from t_ans)) ->> 'status',
  'submitted', 'waits for manual grading of the open question');
select is((select score from public.quiz_attempts), 1.00::numeric, 'forged option scores 0, normalised short answer scores 1');
select throws_ok($$ select public.submit_quiz_attempt(((select p ->> 'attempt_id' from t_a))::uuid, '[]') $$, '23514', null,
  'cannot submit twice');
select throws_ok($$ select public.start_quiz_attempt('fe000000-0000-0000-0000-000000000001') $$, '23514', null,
  'max attempts enforced');
select is_empty($$ select * from public.quiz_answers $$, 'student cannot read answer rows directly');
select is((public.get_attempt_result(((select p ->> 'attempt_id' from t_a))::uuid) ->> 'answers_revealed')::boolean, false,
  'answers hidden before answers_visible_at');
select is(jsonb_array_length(public.get_attempt_result(((select p ->> 'attempt_id' from t_a))::uuid) -> 'questions'), 0,
  'no per-question data before reveal');
select throws_ok($$ select public.grade_quiz_answer((select id from public.quiz_attempts), 3, '') $$, '42501', null,
  'student cannot grade');

select tests.act_as('f0000000-0000-0000-0000-00000000000a');
select throws_ok($$ select public.grade_quiz_answer((select id from public.quiz_answers where question_id = (select sm from t_q)), 4, '') $$,
  '23514', null, 'manual points cannot exceed question points');
select public.grade_quiz_answer((select id from public.quiz_answers where question_id = (select sm from t_q)), 3, 'ดี');
select results_eq($$ select status::text, score from public.quiz_attempts $$, $$ values ('graded', 4.00::numeric) $$,
  'manual grade completes the attempt: 4/6');
select is((select sum(amount)::int from public.xp_transactions where source_type = 'quiz'), 40, 'passing (≥50%) gives quiz XP once');
select public.grade_quiz_answer((select id from public.quiz_answers where question_id = (select sm from t_q)), 3, 'ดีมาก');
select is((select count(*)::int from public.xp_transactions where source_type = 'quiz'), 1, 're-grading does not duplicate XP');
select is((select score_percent from public.competency_results where source_type = 'quiz'), 0.00::numeric,
  'competency evidence from the quiz (MC answered wrong → 0%)');

select tests.reset_actor();
update public.quizzes set answers_visible_at = now() - interval '1 minute';
select tests.act_as('f0000000-0000-0000-0000-00000000000b');
select is(jsonb_array_length(public.get_attempt_result(((select p ->> 'attempt_id' from t_a))::uuid) -> 'questions'), 3,
  'after reveal time the student sees answers and explanations');

select * from finish(true);
rollback;

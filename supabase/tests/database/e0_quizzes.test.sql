begin;
select plan(13);

select tests.create_user('e0000000-0000-0000-0000-00000000000a', 't@school.test', 'active', 'teacher');
select tests.create_user('e0000000-0000-0000-0000-00000000000b', 's@school.test', 'active', 'student');
select tests.create_user('e0000000-0000-0000-0000-00000000000d', 't2@school.test', 'active', 'teacher');
select tests.act_as('e0000000-0000-0000-0000-00000000000a');
insert into public.courses (id, code, name, level, term, academic_year, created_by, weeks, status)
values ('ec000000-0000-0000-0000-000000000001', 'QZ', 'Quiz', 'pvc', 1, 2569, 'e0000000-0000-0000-0000-00000000000a', 1, 'published');
insert into public.course_members (course_id, user_id, member_role)
values ('ec000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-00000000000b', 'student');

create temporary table t_q on commit drop as select public.save_question(null, 'ec000000-0000-0000-0000-000000000001',
  '{"type":"mc","stem":"ขา GPIO ใดใช้ต่อ LED ในตัวอย่าง?","points":2,"options":[{"label":"13","is_correct":true},{"label":"A0"},{"label":"GND"}]}') as id;
grant select on t_q to authenticated;
select is((select count(*)::int from public.question_options where question_id = (select id from t_q)), 3, 'mc question saved with options');
select throws_ok($$ select public.save_question(null, 'ec000000-0000-0000-0000-000000000001',
  '{"type":"mc","stem":"x","options":[{"label":"a","is_correct":true},{"label":"b","is_correct":true}]}') $$, '23514', null,
  'mc needs exactly one correct option');
select throws_ok($$ select public.save_question(null, 'ec000000-0000-0000-0000-000000000001',
  '{"type":"tf","stem":"x","options":[{"label":"จริง","is_correct":true}]}') $$, '23514', null, 'tf needs two options');
select lives_ok($$ select public.save_question(null, 'ec000000-0000-0000-0000-000000000001',
  '{"type":"short","stem":"ย่อมาจากอะไร IoT","options":[{"label":"Internet of Things","is_correct":true}]}') $$, 'short answer with accepted answer');
select lives_ok($$ select public.save_question((select id from t_q), 'ec000000-0000-0000-0000-000000000001',
  '{"type":"tf","stem":"LED มีขั้ว","options":[{"label":"จริง","is_correct":true},{"label":"เท็จ"}]}') $$, 'edit replaces options atomically');
select is((select count(*)::int from public.question_options where question_id = (select id from t_q)), 2, 'options replaced');

insert into public.quizzes (id, course_id, kind, title, published)
values ('ef000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-000000000001', 'pretest', 'Pre-test', true);
select lives_ok($$ select public.set_quiz_questions('ef000000-0000-0000-0000-000000000001', array[(select id from t_q)]) $$,
  'teacher sets quiz questions');

select tests.act_as('e0000000-0000-0000-0000-00000000000d');
select throws_ok($$ select public.save_question((select id from t_q), 'ec000000-0000-0000-0000-000000000001', '{"type":"tf","stem":"x","options":[]}') $$,
  '42501', null, 'other teacher cannot edit question');

select tests.act_as('e0000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.quizzes), 1, 'student sees the published quiz');
select is_empty($$ select * from public.questions $$, 'student cannot read the question bank');
select is_empty($$ select * from public.question_options $$, 'student cannot read options / correct answers');
select is_empty($$ select * from public.quiz_questions $$, 'student cannot read quiz composition');
select throws_ok($$ select public.save_question(null, 'ec000000-0000-0000-0000-000000000001',
  '{"type":"short","stem":"x","options":[]}') $$, '42501', null, 'student cannot create questions');

select * from finish(true);
rollback;

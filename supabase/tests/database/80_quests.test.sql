begin;
select plan(19);

select tests.create_user('80000000-0000-0000-0000-00000000000a', 't@school.test', 'active', 'teacher');
select tests.create_user('80000000-0000-0000-0000-00000000000b', 's@school.test', 'active', 'student');
select tests.create_user('80000000-0000-0000-0000-00000000000c', 'out@school.test', 'active', 'student');

select tests.act_as('80000000-0000-0000-0000-00000000000a');
insert into public.courses (id, code, name, level, term, academic_year, created_by, weeks, status)
values ('8c000000-0000-0000-0000-000000000001', 'Q1', 'Quests', 'pvc', 1, 2569,
        '80000000-0000-0000-0000-00000000000a', 1, 'published');
insert into public.course_members (course_id, user_id, member_role)
values ('8c000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-00000000000b', 'student');
insert into public.quests (id, course_id, title, published, max_attempts, submit_modes) values
  ('8a000000-0000-0000-0000-000000000001', '8c000000-0000-0000-0000-000000000001', 'Mission 01', true, 2, array['text','url','file']),
  ('8a000000-0000-0000-0000-000000000002', '8c000000-0000-0000-0000-000000000001', 'Mission 02', true, 1, array['url']),
  ('8a000000-0000-0000-0000-000000000003', '8c000000-0000-0000-0000-000000000001', 'Draft', false, 1, array['text']);
insert into public.quests (id, course_id, title, published, due_at, allow_late, submit_modes) values
  ('8a000000-0000-0000-0000-000000000004', '8c000000-0000-0000-0000-000000000001', 'Closed', true, now() - interval '1 day', false, array['text']),
  ('8a000000-0000-0000-0000-000000000005', '8c000000-0000-0000-0000-000000000001', 'Late ok', true, now() - interval '1 day', true, array['text']);
insert into public.quest_prerequisites values ('8a000000-0000-0000-0000-000000000002', '8a000000-0000-0000-0000-000000000001');
select throws_ok($$ insert into public.quests (course_id, title, submit_modes)
  values ('8c000000-0000-0000-0000-000000000001', 'X', array['classroom']) $$, '23514', null,
  'classroom mode requires a Google Classroom link');

select tests.act_as('80000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.quests), 4, 'student sees only published quests');
select throws_ok($$ select public.submit_quest('8a000000-0000-0000-0000-000000000003', 'x') $$, '42501', null,
  'cannot submit unpublished quest');
select throws_ok($$ select public.submit_quest('8a000000-0000-0000-0000-000000000001') $$, '23514', null,
  'empty submission rejected');
select throws_ok($$ select public.submit_quest('8a000000-0000-0000-0000-000000000002', null, 'https://x.test') $$,
  '23514', null, 'locked until prerequisite approved');
select throws_ok($$ select public.submit_quest('8a000000-0000-0000-0000-000000000002', 'text') $$,
  '23514', null, 'disallowed submit mode rejected');
select throws_ok($$ select public.submit_quest('8a000000-0000-0000-0000-000000000001', null, 'http://insecure.test') $$,
  '23514', null, 'non-https URL rejected');
select is((public.submit_quest('8a000000-0000-0000-0000-000000000001', 'my work')).attempt_no::int, 1, 'first submission');
select throws_ok($$ select public.submit_quest('8a000000-0000-0000-0000-000000000001', 'again') $$, '23514',
  'CQ_ALREADY_SUBMITTED', 'cannot resubmit while pending review');
select throws_ok($$ insert into public.quest_submissions (quest_id, course_id, user_id, attempt_no, content_text)
  values ('8a000000-0000-0000-0000-000000000001', '8c000000-0000-0000-0000-000000000001',
          '80000000-0000-0000-0000-00000000000b', 9, 'forged') $$, '42501', null, 'no direct inserts');
select throws_ok($$ update public.quest_submissions set status = 'approved' $$, '42501', null,
  'student cannot approve own submission');

-- teacher asks for revision → second attempt allowed, third is not
select tests.reset_actor();
update public.quest_submissions set status = 'needs_revision';
select tests.act_as('80000000-0000-0000-0000-00000000000b');
select is((public.submit_quest('8a000000-0000-0000-0000-000000000001', 'v2')).attempt_no::int, 2, 'resubmission after revision');
select tests.reset_actor();
update public.quest_submissions set status = 'needs_revision';
select tests.act_as('80000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.submit_quest('8a000000-0000-0000-0000-000000000001', 'v3') $$, '23514',
  'CQ_NO_ATTEMPTS_LEFT', 'attempt limit enforced');

-- deadlines
select throws_ok($$ select public.submit_quest('8a000000-0000-0000-0000-000000000004', 'late') $$, '23514',
  'CQ_PAST_DUE', 'past due rejected when late not allowed');
select is((public.submit_quest('8a000000-0000-0000-0000-000000000005', 'late')).is_late, true, 'late flagged');

-- files: must be the student's own uploaded object under course/user path
select throws_ok($$ select public.submit_quest('8a000000-0000-0000-0000-000000000001', null, null,
  '8c000000-0000-0000-0000-000000000001/80000000-0000-0000-0000-00000000000c/x.pdf') $$, '23514', null,
  'cannot attach another user''s file path');

-- storage policies
select lives_ok($$ insert into storage.objects (bucket_id, name, owner) values ('submissions',
  '8c000000-0000-0000-0000-000000000001/80000000-0000-0000-0000-00000000000b/a.pdf', '80000000-0000-0000-0000-00000000000b') $$,
  'student uploads into own folder');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner) values ('submissions',
  '8c000000-0000-0000-0000-000000000001/80000000-0000-0000-0000-00000000000a/a.pdf', '80000000-0000-0000-0000-00000000000b') $$,
  '42501', null, 'student cannot upload into another user folder');

select tests.act_as('80000000-0000-0000-0000-00000000000c');
select is_empty($$ select * from public.quest_submissions $$, 'non-member sees no submissions');

select * from finish(true);
rollback;

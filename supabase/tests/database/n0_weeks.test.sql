begin;
select plan(5);

select tests.create_user('a7000000-0000-0000-0000-00000000000a', 't@school.test', 'active', 'teacher');
select tests.create_user('a7000000-0000-0000-0000-00000000000b', 's@school.test', 'active', 'student');
select tests.create_user('a7000000-0000-0000-0000-00000000000c', 'out@school.test', 'active', 'student');
select tests.act_as('a7000000-0000-0000-0000-00000000000a');
insert into public.courses (id, code, name, level, term, academic_year, created_by, weeks, status)
values ('a7c00000-0000-0000-0000-000000000001', 'WK', 'Weeks', 'pvc', 1, 2569, 'a7000000-0000-0000-0000-00000000000a', 1, 'published');
insert into public.course_members (course_id, user_id, member_role)
values ('a7c00000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-00000000000b', 'student');
insert into public.quests (id, course_id, title, published) values
  ('a7a00000-0000-0000-0000-000000000001', 'a7c00000-0000-0000-0000-000000000001', 'Q', true);

select tests.act_as('a7000000-0000-0000-0000-00000000000b');
select is((public.my_learning_weeks('a7c00000-0000-0000-0000-000000000001') ->> 'current_streak')::int, 0, 'no activity → 0, no negative values');

select tests.reset_actor();
-- activity this week, 1 week ago, (gap 2 weeks ago — forgiven), 3 weeks ago; 6 weeks ago separate
insert into public.quest_submissions (quest_id, course_id, user_id, attempt_no, content_text, submitted_at)
select 'a7a00000-0000-0000-0000-000000000001', 'a7c00000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-00000000000b',
       n, 'x', now() - make_interval(weeks => w)
  from (values (1, 0), (2, 1), (3, 3), (4, 6)) v(n, w);

select tests.act_as('a7000000-0000-0000-0000-00000000000b');
select is((public.my_learning_weeks('a7c00000-0000-0000-0000-000000000001') ->> 'total_weeks')::int, 4, 'four active weeks in total');
select is((public.my_learning_weeks('a7c00000-0000-0000-0000-000000000001') ->> 'current_streak')::int, 3,
  'streak 3: one missed week is forgiven, two consecutive missed weeks end it');
select is(jsonb_array_length(public.my_learning_weeks('a7c00000-0000-0000-0000-000000000001') -> 'recent'), 8, 'last 8 weeks');

select tests.act_as('a7000000-0000-0000-0000-00000000000c');
select is(public.my_learning_weeks('a7c00000-0000-0000-0000-000000000001'), null, 'non-members get nothing');

select * from finish(true);
rollback;

\set ON_ERROR_STOP on
do $$ begin
  assert (select count(*) from public.profiles where email like 'student%@example.test') = 30, '30 students';
  assert (select count(*) from public.course_members where member_role = 'student') = 30, '30 enrolled';
  assert (select count(*) from public.learning_units where course_id = '00000000-0000-4000-c000-000000000001') = 18, '18 weeks';
  assert (select count(*) from public.quests) = 10, '10 missions';
  assert (select count(*) from public.quests where type = 'boss') = 1, 'one boss';
  assert (select count(*) from public.quest_prerequisites) = 9, 'mission chain';
  assert (select count(*) from public.lessons where prerequisite_lesson_id is not null) = 9, 'lesson chain';
  assert (select count(*) from public.xp_transactions) = 0, 'seed contains no XP / results';
  assert (select count(*) from public.quest_reviews) = 0, 'seed contains no reviews';
  assert not exists (select 1 from auth.users where email not like '%@example.test'), 'only test accounts';
end $$;
select 'SEED OK';

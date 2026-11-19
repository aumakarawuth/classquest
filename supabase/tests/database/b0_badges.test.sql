begin;
select plan(12);

select tests.create_user('b0000000-0000-0000-0000-00000000000a', 't@school.test', 'active', 'teacher');
select tests.create_user('b0000000-0000-0000-0000-00000000000b', 's@school.test', 'active', 'student');
select tests.create_user('b0000000-0000-0000-0000-00000000000c', 's2@school.test', 'active', 'student');
select tests.act_as('b0000000-0000-0000-0000-00000000000a');
insert into public.courses (id, code, name, level, term, academic_year, created_by, weeks, status)
values ('bc000000-0000-0000-0000-000000000001', 'BG', 'Badges', 'pvc', 1, 2569, 'b0000000-0000-0000-0000-00000000000a', 1, 'published');
update public.learning_units set published = true where course_id = 'bc000000-0000-0000-0000-000000000001';
insert into public.lessons (id, unit_id, position, title, published)
select 'be000000-0000-0000-0000-000000000001', id, 1, 'L1', true from public.learning_units
 where course_id = 'bc000000-0000-0000-0000-000000000001';
insert into public.quests (id, course_id, title, type, published, xp_reward) values
  ('ba000000-0000-0000-0000-000000000001', 'bc000000-0000-0000-0000-000000000001', 'Boss', 'boss', true, 300);
insert into public.course_members (course_id, user_id, member_role) values
  ('bc000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 'student'),
  ('bc000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000c', 'student');
insert into public.badges (id, course_id, name, icon, xp_bonus) values
  ('bb000000-0000-0000-0000-000000000001', 'bc000000-0000-0000-0000-000000000001', 'ช่วยเหลือเพื่อน', 'star', 15);

select tests.act_as('b0000000-0000-0000-0000-00000000000b');
select public.complete_lesson('be000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.user_badges ub join public.badges b on b.id = ub.badge_id where b.name = 'ก้าวแรก'),
  1, 'first lesson unlocks "ก้าวแรก" automatically');
select is((select xp from public.my_course_progress('bc000000-0000-0000-0000-000000000001')), 20,
  'lesson XP 10 + badge bonus 10');
select throws_ok($$ select public.award_badge('bb000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b',
  'bc000000-0000-0000-0000-000000000001', 'self') $$, '42501', null, 'student cannot award badges');
select throws_ok($$ insert into public.user_badges (user_id, badge_id, course_id) values ('b0000000-0000-0000-0000-00000000000b',
  'bb000000-0000-0000-0000-000000000001', 'bc000000-0000-0000-0000-000000000001') $$, '42501', null, 'no direct inserts');
select tests.act_as('b0000000-0000-0000-0000-00000000000b');
create temporary table t_sub on commit drop as
  select (public.submit_quest('ba000000-0000-0000-0000-000000000001', 'smart home')).id as id;
grant select on t_sub to authenticated;

select tests.act_as('b0000000-0000-0000-0000-00000000000a');
select public.review_submission((select id from t_sub), 'approved', 10, '', null, 'boss-approve-1');
select results_eq($$ select b.name from public.user_badges ub join public.badges b on b.id = ub.badge_id
   where ub.user_id = 'b0000000-0000-0000-0000-00000000000b' order by b.name $$,
  $$ values ('ก้าวแรก'), ('นักผจญภัย'), ('ผู้พิชิตบอส') $$, 'boss approval unlocks quest + boss badges (430 XP < level 5)');
select is((select sum(amount)::int from public.xp_transactions where user_id = 'b0000000-0000-0000-0000-00000000000b'),
  10 + 10 + 300 + 20 + 100, 'XP = lesson + bonuses + boss; no duplicates');
select ok(public.award_badge('bb000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b',
  'bc000000-0000-0000-0000-000000000001', 'ช่วยเพื่อนต่อวงจร'), 'teacher awards manual badge');
select ok(not public.award_badge('bb000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b',
  'bc000000-0000-0000-0000-000000000001', 'again'), 'awarding twice is a no-op');
select is((select count(*)::int from public.xp_transactions where source_type = 'badge'
            and source_id = 'bb000000-0000-0000-0000-000000000001'), 1, 'manual badge bonus once');
select tests.reset_actor();
select is((select count(*)::int from public.audit_logs where action = 'badge.awarded'), 1, 'manual award audited once');

select tests.act_as('b0000000-0000-0000-0000-00000000000c');
select is_empty($$ select * from public.user_badges $$, 'student cannot see another student''s badges');
select is((select count(*)::int from public.badges), 6, 'student sees global + own course badges');

select * from finish(true);
rollback;

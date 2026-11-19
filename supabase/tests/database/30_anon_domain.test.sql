begin;
select plan(4);

select tests.act_as_anon();
select throws_ok($$ select * from public.courses $$, '42501', null, 'anon cannot read courses');
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon cannot read profiles');
select tests.reset_actor();

update public.system_settings set value = '["school.test"]' where key = 'auth.allowed_email_domains';
select throws_ok($$ insert into auth.users (email) values ('someone@gmail.com') $$,
  '23514', null, 'email outside allowed domain is rejected');
select lives_ok($$ insert into auth.users (email) values ('new@SCHOOL.test') $$,
  'allowed domain accepted case-insensitively');

select * from finish(true);
rollback;

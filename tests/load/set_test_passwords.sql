-- LOAD-TEST HELPER — run ONLY in a staging/test Supabase project that contains the dev seed.
-- Gives the fictional @example.test accounts a password so k6 can sign in with the email provider
-- (production uses Google sign-in only). Refuses to run if any real account exists.
do $$
begin
  if exists (select 1 from auth.users where email not like '%@example.test') then
    raise exception 'Refusing: non-test accounts present (is this production?)';
  end if;
end $$;

update auth.users
   set encrypted_password = extensions.crypt(:'password', extensions.gen_salt('bf')),
       email_confirmed_at = coalesce(email_confirmed_at, now()),
       aud = 'authenticated', role = 'authenticated'
 where email like 'student%@example.test';

select count(*) as students_ready from auth.users where email like 'student%@example.test' and encrypted_password is not null;

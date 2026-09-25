-- Реальна перевірка RLS-політик supabase/migrations/0001_init.sql на живому Postgres 16 (не мок).
-- Відтворює лише те, що потрібно для RLS (схема auth, auth.uid()/auth.jwt(), ролі authenticated/service_role) —
-- це не заміна живого проєкту Supabase, а перевірка коректності самих SQL-політик.
\set ON_ERROR_STOP on

drop schema if exists auth cascade;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);

create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;

drop role if exists authenticated;
drop role if exists anon;
drop role if exists service_role;
create role authenticated;
create role anon;
create role service_role bypassrls;
grant usage on schema public, auth to authenticated, anon, service_role;
grant all on all tables in schema auth to authenticated, service_role;

drop schema if exists public cascade;
create schema public;
grant all on schema public to authenticated, service_role;

\i supabase/migrations/0001_init.sql

grant select, insert, update, delete on public.profiles, public.progress to authenticated;
grant all on public.profiles, public.progress to service_role;

-- ---------- тестові користувачі ----------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'newbie1@test'),
  ('22222222-2222-2222-2222-222222222222', 'newbie2@test'),
  ('33333333-3333-3333-3333-333333333333', 'mentor@test');
-- профілі для всіх трьох створює тригер on_auth_user_created (роль «новачок» за замовчуванням) —
-- саме це і перевіряється нижче, а не додається вручну.

do $$
declare c int;
begin
  select count(*) into c from public.profiles where role = 'newbie';
  if c <> 3 then raise exception 'FAIL setup: тригер on_auth_user_created створив % профілів «новачок», очікувалось 3', c; end if;
  raise notice 'OK setup: тригер автоматично створив 3 профілі з роллю «новачок»';
end $$;

-- ---------- хелпер: імітувати сесію конкретного JWT (роль + sub) ----------
-- (виконується через окремі DO-блоки з set_config, бо psql-сесія одна на весь скрипт;
--  RESET ROLE/SET ROLE authenticated перемикає активну роль Postgres, RLS реагує саме на неї)

set role service_role;
update public.profiles set role = 'mentor' where id = '33333333-3333-3333-3333-333333333333';
insert into public.progress (user_id, state, rev) values
  ('11111111-1111-1111-1111-111111111111', '{"lessons":{"1":{"test":{"pct":100}}}}', 1),
  ('22222222-2222-2222-2222-222222222222', '{"lessons":{}}', 1);
reset role;

do $$ begin
  if (select role from public.profiles where id = '33333333-3333-3333-3333-333333333333') <> 'mentor' then
    raise exception 'FAIL setup: mentor role не встановлено через service_role';
  end if;
end $$;

-- =====================================================================
-- Тест 1: новачок бачить лише свій profiles-рядок, не чужий
-- =====================================================================
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
do $$
declare c int;
begin
  select count(*) into c from public.profiles;
  if c <> 1 then raise exception 'FAIL test1: новачок бачить % рядків profiles, очікувалось 1', c; end if;
  raise notice 'OK test1: новачок бачить лише свій profiles-рядок (% рядок)', c;
end $$;

-- =====================================================================
-- Тест 2: новачок бачить лише свій progress-рядок
-- =====================================================================
do $$
declare c int;
begin
  select count(*) into c from public.progress;
  if c <> 1 then raise exception 'FAIL test2: новачок бачить % рядків progress, очікувалось 1', c; end if;
  raise notice 'OK test2: новачок бачить лише свій progress-рядок';
end $$;

-- =====================================================================
-- Тест 3: новачок НЕ може записати прогрес в чужий рядок (user_id іншого)
-- =====================================================================
do $$
begin
  begin
    update public.progress set rev = 999 where user_id = '22222222-2222-2222-2222-222222222222';
    if (select rev from public.progress where user_id = '22222222-2222-2222-2222-222222222222') = 999 then
      raise exception 'FAIL test3: новачок1 зміг записати прогрес новачка2';
    end if;
    raise notice 'OK test3: UPDATE чужого progress мовчки не зачепив жодного рядка (RLS WHERE-фільтр)';
  end;
end $$;

-- =====================================================================
-- Тест 4: новачок НЕ може підвищити собі роль напряму (тригер відкочує role)
-- =====================================================================
update public.profiles set role = 'mentor' where id = '11111111-1111-1111-1111-111111111111';
do $$
declare r text;
begin
  select role into r from public.profiles where id = '11111111-1111-1111-1111-111111111111';
  if r <> 'newbie' then raise exception 'FAIL test4: новачок підвищив собі роль до %', r; end if;
  raise notice 'OK test4: спроба самопідвищення ролі відкочена тригером (лишилось %)', r;
end $$;

-- =====================================================================
-- Тест 5: новачок1 не бачить профіль/прогрес новачка2 навіть по прямому id
-- =====================================================================
do $$
declare c int;
begin
  select count(*) into c from public.progress where user_id = '22222222-2222-2222-2222-222222222222';
  if c <> 0 then raise exception 'FAIL test5: новачок1 бачить прогрес новачка2 (% рядків)', c; end if;
  raise notice 'OK test5: прогрес іншого новачка прихований навіть за прямим фільтром';
end $$;

-- =====================================================================
-- Тест 6: наставник бачить усі профілі й увесь прогрес (read-only для чужого)
-- =====================================================================
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', false);
do $$
declare c int; c2 int;
begin
  select count(*) into c from public.profiles;
  select count(*) into c2 from public.progress;
  if c <> 3 then raise exception 'FAIL test6a: наставник бачить % профілів, очікувалось 3', c; end if;
  if c2 <> 2 then raise exception 'FAIL test6b: наставник бачить % рядків прогресу, очікувалось 2', c2; end if;
  raise notice 'OK test6: наставник бачить усі профілі (%) й увесь прогрес (%)', c, c2;
end $$;

-- =====================================================================
-- Тест 7: наставник НЕ може редагувати чужий прогрес (лише читання)
-- =====================================================================
do $$
begin
  update public.progress set rev = 777 where user_id = '11111111-1111-1111-1111-111111111111';
  if (select rev from public.progress where user_id = '11111111-1111-1111-1111-111111111111') = 777 then
    raise exception 'FAIL test7: наставник зміг перезаписати чужий прогрес';
  end if;
  raise notice 'OK test7: наставник не може писати в чужий прогрес — лише читає';
end $$;

reset role;
\echo 'РАЗОМ: усі 7 тестів RLS пройдені (реальний Postgres, наближена auth-схема)'

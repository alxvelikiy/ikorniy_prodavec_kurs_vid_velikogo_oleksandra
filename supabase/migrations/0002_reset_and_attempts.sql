-- Ikorka Shop — публічний деплой, зріз 2 (кабінет наставника): скидання прогресу і журнал спроб.
-- Виконати після 0001_init.sql, повністю, один раз. Детальна інструкція: v2/mvp/SUPABASE_SETUP.md

-- ============================================================
-- 1. progress.generation — «покоління» прогресу новачка.
-- ============================================================
-- Бампається лише reset_progress() нижче (наставник). Клієнт (account.js) порівнює своє локальне
-- покоління з хмарним: якщо хмарне більше — локальний кеш вважається застарілим і ЗАМІНЮЄТЬСЯ
-- хмарним станом повністю (без union-злиття), інакше старий локальний кеш «воскресив» би скинутий
-- урок назад у хмару при наступній синхронізації.
alter table public.progress add column if not exists generation integer not null default 0;

-- ============================================================
-- 2. reset_progress(p_user_id, p_lesson_n) — скидання прогресу наставником.
-- ============================================================
-- p_lesson_n = null → повне скидання (порожній стан). p_lesson_n = N → прибирає лише state.lessons[N]
-- (новачок ніби не проходив саме цей урок; решта прогресу — повторення, симулятор, колода — не чіпається).
-- SECURITY DEFINER — обходить RLS (наставнику заборонено писати в чужий progress, тест 7 rls-test.sql),
-- але сам перевіряє is_mentor() усередині, тож звичайний новачок викликати його з користю не може.
create or replace function public.reset_progress(p_user_id uuid, p_lesson_n int default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  blank_state jsonb := '{"v":1,"created":0,"days":{},"last":null,"pos":{},"lessons":{},"review":{},"daily":{},"goal":null,"goals":[],"sections":{},"final":[],"sim":{},"deck":[]}'::jsonb;
begin
  if not public.is_mentor() then
    raise exception 'reset_progress: лише наставник може скидати прогрес';
  end if;
  if p_lesson_n is null then
    update public.progress
      set state = blank_state,
          rev = coalesce(rev, 0) + 1,
          generation = coalesce(generation, 0) + 1,
          updated_at = now()
      where user_id = p_user_id;
  else
    update public.progress
      set state = jsonb_set(coalesce(state, '{}'::jsonb), '{lessons}', coalesce(state -> 'lessons', '{}'::jsonb) - p_lesson_n::text),
          rev = coalesce(rev, 0) + 1,
          generation = coalesce(generation, 0) + 1,
          updated_at = now()
      where user_id = p_user_id;
  end if;
end;
$$;

revoke all on function public.reset_progress(uuid, int) from public;
grant execute on function public.reset_progress(uuid, int) to authenticated;

-- ============================================================
-- 3. attempts — append-only журнал спроб (тест уроку / тренажер): для «історії спроб», а не лише
--    останнього/найкращого результату, який лишається в progress.state.
-- ============================================================
create table if not exists public.attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_n int not null,
  kind text not null check (kind in ('test', 'sim')),
  pct int,
  passed boolean,
  mistakes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.attempts enable row level security;

create policy "attempts_insert_own" on public.attempts
  for insert with check (auth.uid() = user_id);

create policy "attempts_select_own_or_mentor" on public.attempts
  for select using (auth.uid() = user_id or public.is_mentor());

-- Немає update/delete-політик навмисно — RLS за замовчуванням забороняє обидві дії всім, окрім
-- service_role, для будь-кого. Це і робить таблицю append-only на рівні бази, не лише за домовленістю.

create index if not exists attempts_user_created_idx on public.attempts (user_id, created_at desc);

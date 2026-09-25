-- Ikorka Shop — публічний деплой, зріз 1 (auth + ролі + прогрес).
-- Виконати повністю в Supabase SQL Editor одного разу на новому проєкті.
-- Детальна інструкція: v2/mvp/SUPABASE_SETUP.md

-- ============================================================
-- 1. profiles — профіль і роль користувача (mentor / newbie)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'newbie' check (role in ('newbie', 'mentor')),
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Перевірка «я наставник?» винесена в SECURITY DEFINER функцію, власник якої (роль, що виконує цю
-- міграцію) звільнений від RLS на «своїй» таблиці — інакше підзапит до profiles усередині ж політики
-- profiles викликає ту саму політику рекурсивно («infinite recursion detected in policy»), це відома
-- пастка Postgres RLS. Перевірено на живому Postgres, не лише синтаксично — v2/mvp/tests/rls-test.sql.
create or replace function public.is_mentor()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'mentor');
$$;

-- Новачок бачить свій профіль; наставник бачить усіх — потрібно для списку новачків у кабінеті (зріз 2).
create policy "profiles_select_own_or_mentor" on public.profiles
  for select using (auth.uid() = id or public.is_mentor());

-- Редагувати можна лише свій рядок (наприклад, ім'я для відображення).
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Захист від самопідвищення ролі: клієнтський UPDATE не може змінити role (лише service_role — вручну
-- через SQL Editor власником курсу, див. «Призначити роль mentor» у SUPABASE_SETUP.md).
-- Перевіряємо саме поточну роль Postgres-сесії через GUC 'role' (те, що змінює SET ROLE), а не
-- current_user/поле «role» у JWT-клеймах: функція SECURITY DEFINER підмінює current_user на власника
-- функції, тож current_user тут завжди показував би того, хто створив функцію, а не того, хто викликав
-- UPDATE. PostgREST реально виконує SET ROLE service_role при використанні service-ключа, тож
-- current_setting('role') коректно відображає це і для запитів API, і для прямих SQL-скриптів.
create or replace function public.prevent_role_self_escalation()
returns trigger language plpgsql security definer as $$
begin
  if new.role is distinct from old.role and coalesce(current_setting('role', true), '') <> 'service_role' then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_role_self_escalation on public.profiles;
create trigger trg_prevent_role_self_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();

-- Автостворення профілю (роль «новачок») одразу після реєстрації в auth.users.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role) values (new.id, 'newbie')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2. progress — прогрес новачка, увесь клієнтський стан одним JSON-об'єктом (той самий, що досі жив
--    у localStorage «ikorka-mvp») + монотонний лічильник rev для узгодження між пристроями.
-- ============================================================
create table if not exists public.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  rev integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

-- Новачок читає й пише лише свій прогрес; наставник лише читає (без права редагувати чужий прогрес).
create policy "progress_select_own_or_mentor" on public.progress
  for select using (auth.uid() = user_id or public.is_mentor());

create policy "progress_upsert_own" on public.progress
  for insert with check (auth.uid() = user_id);

create policy "progress_update_own" on public.progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Ikorka Shop — публічний деплой, зріз 5: per-user ліміт ІІ-тренера (замість спільного файлу usage.json,
-- який на serverless-функції Netlify однаково не пережив би між викликами — кожен виклик стартує «з нуля»).
-- Виконати після 0001/0002, повністю, один раз. Детальна інструкція: v2/mvp/SUPABASE_SETUP.md

create table if not exists public.coach_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  calls int not null default 0,
  ok int not null default 0,
  errors int not null default 0,
  primary key (user_id, day)
);

alter table public.coach_usage enable row level security;

create policy "coach_usage_select_own_or_mentor" on public.coach_usage
  for select using (auth.uid() = user_id or public.is_mentor());

-- Немає insert/update-політик для клієнта навмисно — запис лише через bump_coach_usage() нижче
-- (SECURITY DEFINER, атомарний інкремент). Пряме read-then-write з функції Netlify мало б гонитву між
-- двома одночасними викликами того самого користувача; insert ... on conflict do update тут атомарний.

create or replace function public.bump_coach_usage(p_calls int default 0, p_ok int default 0, p_errors int default 0)
returns table(calls int, ok int, errors int)
language plpgsql security definer set search_path = public as $$
begin
  insert into public.coach_usage (user_id, day, calls, ok, errors)
  values (auth.uid(), current_date, p_calls, p_ok, p_errors)
  on conflict (user_id, day) do update
    set calls = public.coach_usage.calls + p_calls,
        ok = public.coach_usage.ok + p_ok,
        errors = public.coach_usage.errors + p_errors;
  return query select cu.calls, cu.ok, cu.errors from public.coach_usage cu where cu.user_id = auth.uid() and cu.day = current_date;
end;
$$;

revoke all on function public.bump_coach_usage(int, int, int) from public;
grant execute on function public.bump_coach_usage(int, int, int) to authenticated;

-- Швидка перевірка ліміту ПЕРЕД викликом моделі, без запису (щоб не рахувати спробу, якщо однаково відмовимо).
create or replace function public.get_coach_usage()
returns int language sql stable security definer set search_path = public as $$
  select coalesce((select calls from public.coach_usage where user_id = auth.uid() and day = current_date), 0);
$$;

revoke all on function public.get_coach_usage() from public;
grant execute on function public.get_coach_usage() to authenticated;

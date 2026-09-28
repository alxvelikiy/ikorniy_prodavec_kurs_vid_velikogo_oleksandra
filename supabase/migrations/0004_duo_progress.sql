-- Ikorka Shop — DUO-редизайн: ігровий прогрес (XP, серія, ціль, серця, пройдені вузли шляху, помилки,
-- завдання, досягнення). Окрема таблиця, щоб не чіпати progress (стан тренажера, зріз 1–2).
-- Виконати після 0001–0003, повністю, один раз. Детальна інструкція: v2/mvp/SUPABASE_SETUP.md (розділ DUO).
-- Клієнт: v2/build/assets/duo/progress.js (офлайн-перш за все, злиття DuoProgressCore.merge; при конфлікті XP
-- перемагає сервер). Доступ: кожен бачить і змінює ЛИШЕ свій рядок; видалення з клієнта немає.

create table if not exists public.duo_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  xp_total int not null default 0,        -- рахує сервер (тригер нижче), клієнтському значенню не довіряємо
  updated_at timestamptz not null default now()
);

alter table public.duo_progress enable row level security;

create policy "duo_progress_select_own" on public.duo_progress
  for select using (auth.uid() = user_id);
create policy "duo_progress_insert_own" on public.duo_progress
  for insert with check (auth.uid() = user_id);
create policy "duo_progress_update_own" on public.duo_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- delete-політики немає навмисно: скидання прогресу — лише наставником/адміністратором через Dashboard.

-- XP рахує сервер: сума подій state.xp[]; подія поза межами 0..100 XP — відхиляється (ручне редагування localStorage).
create or replace function public.duo_progress_before_write()
returns trigger language plpgsql as $$
declare total int; bad int;
begin
  if jsonb_typeof(new.state -> 'xp') = 'array' then
    select coalesce(sum((e ->> 'xp')::int), 0),
           count(*) filter (where (e ->> 'xp')::int < 0 or (e ->> 'xp')::int > 100)
      into total, bad
      from jsonb_array_elements(new.state -> 'xp') e;
  else
    total := 0; bad := 0;
  end if;
  if bad > 0 then raise exception 'duo_progress: % подій XP поза межами 0..100', bad; end if;
  new.xp_total := total;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists duo_progress_before_write on public.duo_progress;
create trigger duo_progress_before_write before insert or update on public.duo_progress
  for each row execute function public.duo_progress_before_write();

grant select, insert, update on public.duo_progress to authenticated;

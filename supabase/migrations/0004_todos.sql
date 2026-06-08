-- TimeNodes — günlük gündem / yapılacaklar (to-do)
-- Sol panelde "bugünün gündemi": haftalık tablodan seçilen alışkanlıklar
-- (habit_id dolu) + serbest yazılan to-do'lar (title, done). Gün bazında.

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  habit_id uuid references public.habits (id) on delete cascade,
  title text not null default '',
  done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists todos_user_day_idx on public.todos (user_id, day);

alter table public.todos enable row level security;
drop policy if exists todos_all_own on public.todos;
create policy todos_all_own on public.todos for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

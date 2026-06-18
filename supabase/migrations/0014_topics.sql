-- Etkinliğe bağlı kalıcı konular (ör. Freelance → Müşteri 1, Müşteri 2)
create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);
alter table public.topics enable row level security;
create policy "Kendi konuları" on public.topics
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create index if not exists topics_user_habit_idx on public.topics(user_id, habit_id);

-- Konu bazında günlük çalışma süresi kırılımı (toplam = entries.work_min;
-- konusuz kısım = entries.work_min - bu satırların toplamı)
create table if not exists public.topic_minutes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  day date not null,
  topic_id uuid not null references public.topics(id) on delete cascade,
  work_min int not null default 0,
  created_at timestamptz default now(),
  unique (topic_id, day)
);
alter table public.topic_minutes enable row level security;
create policy "Kendi konu süreleri" on public.topic_minutes
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create index if not exists topic_minutes_user_day_idx on public.topic_minutes(user_id, day);

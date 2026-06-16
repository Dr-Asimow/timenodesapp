create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  text text not null,
  created_at timestamptz default now()
);
alter table public.goals enable row level security;
create policy "Kendi hedefleri" on public.goals
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

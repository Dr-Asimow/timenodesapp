create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  target_at timestamptz not null,
  created_at timestamptz default now()
);
alter table public.reminders enable row level security;
create policy "Kendi hatırlatıcıları" on public.reminders
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

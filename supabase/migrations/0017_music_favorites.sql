-- Favori müzikler: kullanıcının tek tek kaydettiği YouTube videoları
create table public.music_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id text not null,
  title text not null,
  created_at timestamptz default now(),
  unique (user_id, video_id)
);
alter table public.music_favorites enable row level security;
create policy "Kendi favori müzikleri" on public.music_favorites
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

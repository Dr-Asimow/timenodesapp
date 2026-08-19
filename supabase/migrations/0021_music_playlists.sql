-- Çoklu müzik listeleri: kullanıcı birden çok isimli liste tutar,
-- aynı şarkı birden fazla listede olabilir (çoklu üyelik).
-- Not: Tekrar çalıştırmaya karşı güvenli (idempotent) yazılmıştır.

-- Listeler
create table if not exists public.music_playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  position int not null default 0,
  created_at timestamptz default now()
);
alter table public.music_playlists enable row level security;
drop policy if exists "Kendi müzik listeleri" on public.music_playlists;
create policy "Kendi müzik listeleri" on public.music_playlists
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Liste içindeki şarkılar (bir şarkı birden çok listede bulunabilir).
-- video_id + title burada tutulur; liste bazında sıra için position.
create table if not exists public.music_playlist_items (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.music_playlists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id text not null,
  title text not null,
  position int not null default 0,
  created_at timestamptz default now(),
  unique (playlist_id, video_id)
);
alter table public.music_playlist_items enable row level security;
drop policy if exists "Kendi liste şarkıları" on public.music_playlist_items;
create policy "Kendi liste şarkıları" on public.music_playlist_items
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists music_playlist_items_playlist_idx
  on public.music_playlist_items (playlist_id);

-- Mevcut favorileri, her kullanıcı için varsayılan "Favoriler" listesine taşı.
-- (music_favorites tablosu veri kaybı olmasın diye yerinde bırakılır; artık okunmaz.)
-- Zaten taşınmış olanları atlar (tekrar çalıştırılabilir).
do $$
declare
  u record;
  pid uuid;
begin
  for u in (select distinct user_id from public.music_favorites) loop
    -- Kullanıcının "Favoriler" listesi yoksa oluştur
    select id into pid from public.music_playlists
      where user_id = u.user_id and name = 'Favoriler'
      order by created_at
      limit 1;
    if pid is null then
      insert into public.music_playlists (user_id, name, position)
        values (u.user_id, 'Favoriler', 0)
        returning id into pid;
    end if;
    -- Henüz eklenmemiş favorileri listeye aktar
    insert into public.music_playlist_items (playlist_id, user_id, video_id, title, position)
      select pid, mf.user_id, mf.video_id, mf.title,
             (row_number() over (order by mf.created_at)) - 1
      from public.music_favorites mf
      where mf.user_id = u.user_id
        and not exists (
          select 1 from public.music_playlist_items i
          where i.playlist_id = pid and i.video_id = mf.video_id
        );
  end loop;
end $$;

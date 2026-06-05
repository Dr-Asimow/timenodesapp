-- TimeNodes — başlangıç şeması
-- Kimlik: Supabase Auth (auth.users). Her kullanıcı yalnızca kendi verisini görür (RLS).

-- ---------------------------------------------------------------------------
-- profiles: kullanıcı adı eşlemesi
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- habits: kullanıcı seviyesinde alışkanlıklar (haftalar arası paylaşılır)
-- ---------------------------------------------------------------------------
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  position int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists habits_user_idx on public.habits (user_id);

-- ---------------------------------------------------------------------------
-- entries: gün bazında çalışma + mola dakikaları (hücre = habit + tarih)
-- Hafta numarası/başlangıcı istemcide tarihlerden hesaplanır; weeks tablosu gerekmez.
-- ---------------------------------------------------------------------------
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  day date not null,
  work_min int not null default 0,
  break_min int not null default 0,
  updated_at timestamptz not null default now(),
  unique (habit_id, day)
);
create index if not exists entries_user_day_idx on public.entries (user_id, day);

-- ---------------------------------------------------------------------------
-- RLS: yalnızca sahibi erişebilir
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.habits enable row level security;
alter table public.entries enable row level security;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (id = auth.uid());
create policy profiles_insert_own on public.profiles for insert with check (id = auth.uid());
create policy profiles_update_own on public.profiles for update using (id = auth.uid());

drop policy if exists habits_all_own on public.habits;
create policy habits_all_own on public.habits for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists entries_all_own on public.entries;
create policy entries_all_own on public.entries for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Yeni kullanıcı kaydolunca profili otomatik oluştur (username metadata'dan)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- entries.updated_at otomatik güncelle
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists entries_touch on public.entries;
create trigger entries_touch
  before update on public.entries
  for each row execute function public.touch_updated_at();

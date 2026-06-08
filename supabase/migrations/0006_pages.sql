-- TimeNodes — Notion benzeri blok-tabanlı not sayfaları
-- İçerik Tiptap/ProseMirror doküman JSON'u olarak saklanır (doc = blok dizisi).
-- day dolu ise o güne ait not sayfası; null ise genel sayfa (ileride).

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '',
  content jsonb not null default '{}'::jsonb,
  day date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pages_user_idx on public.pages (user_id);
-- Bir kullanıcı + gün için tek sayfa (NULL günler birbirinden bağımsız = genel sayfalar)
create unique index if not exists pages_user_day_uidx
  on public.pages (user_id, day) where day is not null;

alter table public.pages enable row level security;
drop policy if exists pages_all_own on public.pages;
create policy pages_all_own on public.pages for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- updated_at otomatik
create or replace function public.touch_pages_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists pages_touch on public.pages;
create trigger pages_touch before update on public.pages
  for each row execute function public.touch_pages_updated_at();

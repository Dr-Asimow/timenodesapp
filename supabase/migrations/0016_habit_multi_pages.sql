-- TimeNodes — Etkinlik başına birden çok not sayfası
-- Önce "etkinlik başına tek sayfa" tekil kısıtı kaldırılır, sıralama için position eklenir.
-- (Sayfa sayısı sınırı — şimdilik 10 — uygulama tarafında uygulanır.)

drop index if exists public.pages_user_habit_uidx;

alter table public.pages
  add column if not exists position int not null default 0;

create index if not exists pages_user_habit_pos_idx
  on public.pages (user_id, habit_id, position) where habit_id is not null;

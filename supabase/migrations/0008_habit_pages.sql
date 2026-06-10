-- TimeNodes — Etkinlik (habit) sayfaları
-- Güne değil, etkinliğe bağlı not sayfası: gün değişse de aynı sayfa kalır.

alter table public.pages
  add column if not exists habit_id uuid references public.habits (id) on delete cascade;

-- Bir kullanıcı + etkinlik için tek sayfa (NULL habit_id'ler birbirinden bağımsız)
create unique index if not exists pages_user_habit_uidx
  on public.pages (user_id, habit_id) where habit_id is not null;

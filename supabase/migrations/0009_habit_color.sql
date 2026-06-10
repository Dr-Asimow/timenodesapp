-- TimeNodes — Etkinlik renkleri
-- Kullanıcı her etkinliğe (habit) kendi rengini atayabilir; NULL ise varsayılan accent rengi kullanılır.

alter table public.habits
  add column if not exists color text;

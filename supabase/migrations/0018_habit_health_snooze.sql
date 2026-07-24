-- Etkinlik sağlık uyarısını erteleme/kapatma.
-- health_snooze_until: bu tarih/saate kadar uyarı gösterme (null = normal göster).
-- health_muted: true = uyarı tamamen kapalı.
-- Mevcut habits RLS update politikaları yeni kolonları da kapsar.
alter table public.habits
  add column if not exists health_snooze_until timestamptz,
  add column if not exists health_muted boolean not null default false;

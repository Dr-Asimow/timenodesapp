-- Etkinlik ikonu: kullanıcı, etkinlik adının yanındaki renk noktası yerine
-- dolu (filled) bir ikon seçebilir. Değer, ikon anahtarı (ör. "sword", "book").
-- null ise varsayılan renk noktası gösterilir.
-- Mevcut habits RLS update politikaları yeni kolonu da kapsar.
alter table public.habits
  add column if not exists icon text;

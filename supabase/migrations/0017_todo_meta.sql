-- TimeNodes — to-do'lara açıklama, zorluk (kolay/orta/zor) ve deadline alanları
-- (Hepsi opsiyonel; eski to-do'lar NULL kalır.)

alter table public.todos
  add column if not exists description text,
  add column if not exists difficulty text,
  add column if not exists deadline timestamptz;

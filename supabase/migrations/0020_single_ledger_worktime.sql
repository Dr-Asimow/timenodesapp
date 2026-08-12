-- Çalışma süresini TEK DEFTERE indir.
-- Artık çalışma dakikasının tek kaynağı: public.topic_minutes.
--   * Kategori seçiliyse  → topic_id dolu
--   * Kategorisiz ("temel")→ topic_id NULL
-- Bir hücrenin (etkinlik + gün) çalışma toplamı = o (habit_id, day) satırlarının TOPLAMI.
-- Böylece "kategori toplamı hücreyi aşamaz" kuralı tanım gereği hep doğrudur.
--
-- public.entries.work_min bundan sonra OKUNMAZ ve YAZILMAZ; yalnızca eski değerlerin
-- yedeği olarak kalır (geri dönüş gerekirse diye). Mola (break_min) ve not entries'te kalır.
--
-- NOT: Uzlaştırma bloğu bir defa çalışacak biçimde yazılmıştır (ON CONFLICT DO NOTHING);
-- tekrar çalıştırmak birikmiş kategorisiz süreyi ezmez.

-- 1) topic_id artık NULL olabilir (kategorisiz/"temel" süre satırı)
alter table public.topic_minutes alter column topic_id drop not null;

-- 2) Kategorisiz satır için (habit_id, day) benzersizliği.
--    (Mevcut unique(topic_id, day) NULL'ları benzersiz saymaz; bu yüzden partial index.)
create unique index if not exists topic_minutes_habit_day_notopic
  on public.topic_minutes (habit_id, day)
  where topic_id is null;

-- 3) UZLAŞTIRMA — mevcut veriyi tek deftere taşı ve onar.
--    Her hücrenin "kategorisiz" kısmını NULL satırı olarak yaz:
--      temel = entries.work_min - (o hücrenin kategorileri toplamı)
--    * temel > 0  → gerçek kategorisiz süre, NULL satırı olarak eklenir.
--    * temel <= 0 → kategoriler zaten entries'i aşmış (bozuk/bayat hücre);
--                   NULL satırı eklenmez, hücre toplamı otomatik kategoriler kadar olur.
--    Kategorisi olmayan eski etkinliklerde kategori toplamı 0'dır → tüm süre NULL satırına taşınır.
insert into public.topic_minutes (user_id, habit_id, day, topic_id, work_min)
select
  e.user_id,
  e.habit_id,
  e.day,
  null::uuid,
  e.work_min - coalesce(tm.s, 0)
from public.entries e
left join (
  select habit_id, day, sum(work_min) as s
  from public.topic_minutes
  where topic_id is not null
  group by habit_id, day
) tm on tm.habit_id = e.habit_id and tm.day = e.day
where e.work_min - coalesce(tm.s, 0) > 0
on conflict (habit_id, day) where topic_id is null
  do nothing;

-- "İlk alışkanlık" tebrik e-postasının yalnızca bir kez gönderilmesini sağlayan bayrak.
-- Yalnızca congrats-email Edge Function'ı (service role) tarafından yazılır.
alter table public.profiles
  add column if not exists congrats_email_sent boolean not null default false;

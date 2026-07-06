-- "if not exists": kolon daha önce dashboard'dan elle eklendiyse hata vermesin
alter table public.reminders add column if not exists description text;

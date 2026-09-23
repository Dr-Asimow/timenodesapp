-- Günlük planlama: gün başına bir satır. Satırın varlığı "bugünkü plan
-- otomatik açıldı" demektir (aynı gün tekrar otomatik açılmaz).
-- balls = zaman topları [{id, duration (10|30|60), habitId (null = havuzda)}]
-- Gün notu ayrı tutulmaz; mevcut day_notes tablosu kullanılır.
-- Not: Tekrar çalıştırmaya karşı güvenli (idempotent) yazılmıştır.

create table if not exists public.daily_plans (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  balls jsonb not null default '[]'::jsonb,
  opened boolean not null default true,
  updated_at timestamptz default now(),
  primary key (user_id, day)
);
alter table public.daily_plans enable row level security;
drop policy if exists "Kendi günlük planları" on public.daily_plans;
create policy "Kendi günlük planları" on public.daily_plans
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

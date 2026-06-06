-- TimeNodes 0003: aktivite notları (hücre) + gün notları (tarih)

-- Aktivite notu: hücre (habit + gün) bazında, entries'e kolon
alter table public.entries add column if not exists note text;

-- Gün notu: tarih bazında (alışkanlıktan bağımsız)
create table if not exists public.day_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  note text not null default '',
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);
create index if not exists day_notes_user_day_idx on public.day_notes (user_id, day);

alter table public.day_notes enable row level security;
drop policy if exists day_notes_all_own on public.day_notes;
create policy day_notes_all_own on public.day_notes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists day_notes_touch on public.day_notes;
create trigger day_notes_touch
  before update on public.day_notes
  for each row execute function public.touch_updated_at();

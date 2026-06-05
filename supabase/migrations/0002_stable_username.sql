-- TimeNodes 0002: kullanıcı adını sabit/benzersiz giriş handle'ı yap,
-- auth kimliğini isimden ayır (rastgele sentetik mail). Giriş RPC ile çözülür.

-- Görünen ad (ileride değiştirilebilir); başlangıçta username ile aynı
alter table public.profiles add column if not exists display_name text;

-- Kullanıcı adı benzersizliği büyük/küçük harf duyarsız
create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

-- Yeni kullanıcı: profil oluştururken display_name = username
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text := coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1));
begin
  insert into public.profiles (id, username, display_name)
  values (new.id, uname, uname)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Kullanıcı adı müsait mi? (kayıt öncesi kontrol; anon çağırabilir)
create or replace function public.username_available(uname text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(trim(uname))
  );
$$;

-- Kullanıcı adından auth e-postası (giriş için; anlamsız sentetik mail döner)
create or replace function public.auth_email_for_username(uname text)
returns text
language sql
security definer
set search_path = public, auth
as $$
  select u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.username) = lower(trim(uname))
  limit 1;
$$;

grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.auth_email_for_username(text) to anon, authenticated;

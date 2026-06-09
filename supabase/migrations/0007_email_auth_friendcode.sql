-- TimeNodes — E-posta girişine geçiş + benzersiz arkadaş kodu (UID)
-- Model: giriş = gerçek e-posta, görünen ad serbest/değiştirilebilir,
-- arkadaşlık için sistemce verilen değiştirilemez 8 haneli UID (friend_code).

-- username artık zorunlu/benzersiz giriş anahtarı DEĞİL (geriye dönük: nullable)
alter table public.profiles alter column username drop not null;

-- 8 haneli (metin, sıfır dolgulu) benzersiz arkadaş kodu
alter table public.profiles add column if not exists friend_code text;
create unique index if not exists profiles_friend_code_uidx
  on public.profiles (friend_code);

-- Benzersiz, rastgele 8 haneli kod üretici (çakışırsa yeniden dener)
create or replace function public.gen_friend_code()
returns text
language plpgsql
as $$
declare
  code text;
  tries int := 0;
begin
  loop
    code := lpad(floor(random() * 100000000)::int::text, 8, '0');
    exit when not exists (
      select 1 from public.profiles where friend_code = code
    );
    tries := tries + 1;
    if tries > 50 then
      raise exception 'friend_code üretilemedi';
    end if;
  end loop;
  return code;
end;
$$;

-- Yeni kullanıcı: profili display_name + friend_code ile oluştur (username yok)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, friend_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    public.gen_friend_code()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

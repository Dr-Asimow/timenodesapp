-- Kullanıcının kendi hesabını silmesi için RPC fonksiyonu.
-- Tüm kullanıcı verisini (entries, habits, todos, pages, goals, reminders, topics, topic_minutes, day_notes, profiles)
-- sildikten sonra auth.users satırını kaldırır.
create or replace function delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Oturum açık değil';
  end if;

  delete from topic_minutes where user_id = uid;
  delete from topics        where user_id = uid;
  delete from reminders     where user_id = uid;
  delete from goals         where user_id = uid;
  delete from pages         where user_id = uid;
  delete from day_notes     where user_id = uid;
  delete from todos         where user_id = uid;
  delete from entries       where user_id = uid;
  delete from habits        where user_id = uid;
  delete from profiles      where id      = uid;

  delete from auth.users where id = uid;
end;
$$;

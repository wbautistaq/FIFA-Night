-- FIFA Night · una persona, un registro
-- Nombres y apodos se comparan normalizados: sin tildes, sin mayúsculas y sin espacios repetidos.
-- "Beto", "BETO", "Betó" y " beto " son la misma persona dentro de un torneo, y el mismo apodo en la plataforma.

create function norm_name(p text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select lower(regexp_replace(
    translate(btrim(p), 'ÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇáàäâãéèëêíìïîóòöôõúùüûñç', 'AAAAAEEEEIIIIOOOOOUUUUNCaaaaaeeeeiiiiooooouuuunc'),
    '\s+', ' ', 'g'))
$$;

-- Dentro de un torneo, un nombre (normalizado) solo una vez
drop index if exists participants_name_uniq;
create unique index participants_name_norm_uniq on tournament_participants (tournament_id, norm_name(display_name));

-- En la plataforma, un apodo (normalizado) solo una vez
drop index if exists profiles_nickname_uniq;
create unique index profiles_nickname_uniq on profiles (norm_name(nickname)) where nickname is not null;

create or replace function nickname_available(p_nickname text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from profiles
     where nickname is not null and norm_name(nickname) = norm_name(p_nickname)
       and id is distinct from auth.uid())
$$;

-- ¿Ese nombre es el apodo de alguien con cuenta? (para no crear un invitado que suplante o duplique a un jugador)
create function nickname_owner(p_name text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from profiles where nickname is not null and norm_name(nickname) = norm_name(p_name) limit 1
$$;
revoke all on function nickname_owner(text) from public, anon, authenticated;
grant execute on function nickname_owner(text) to service_role;

create or replace function find_players(p_query text) returns table (user_id uuid, nickname text, display_name text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select id, nickname, display_name, avatar_url from profiles
   where nickname is not null and id <> auth.uid() and char_length(btrim(p_query)) >= 3
     and norm_name(nickname) like replace(replace(replace(norm_name(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
   order by (norm_name(nickname) = norm_name(p_query)) desc, char_length(nickname), nickname
   limit 5
$$;

-- Agregar jugadores con cuenta. Si en el torneo ya había un INVITADO con su mismo nombre, no se crea
-- otro participante: ese invitado pasa a ser su cuenta (conserva partidos y equipo).
create or replace function add_players(p_tournament uuid, p_users uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare v_name text; v_added int := 0; u uuid; pr profiles; v_pid uuid; v_count int; v_guest tournament_participants; v_merged boolean := false;
begin
  if not is_organizer(p_tournament) then raise exception 'No autorizado' using errcode = '42501'; end if;
  select name into v_name from tournaments where id = p_tournament;
  foreach u in array coalesce(p_users, '{}') loop
    continue when exists (select 1 from tournament_participants where tournament_id = p_tournament and user_id = u);
    select * into pr from profiles where id = u;
    continue when not found;
    select * into v_guest from tournament_participants
     where tournament_id = p_tournament and norm_name(display_name) = norm_name(coalesce(pr.nickname, pr.display_name));
    if found then
      if v_guest.user_id is not null then
        raise exception 'Ya hay un participante llamado %', v_guest.display_name using errcode = 'P0001';
      end if;
      update tournament_participants
         set user_id = u, nickname = pr.nickname, avatar_url = coalesce(pr.avatar_url, v_guest.avatar_url), gamer_id = coalesce(pr.gamer_id, v_guest.gamer_id)
       where id = v_guest.id;
      delete from participant_tokens where participant_id = v_guest.id;
      update notifications set user_id = u where participant_id = v_guest.id and user_id is null;
      v_pid := v_guest.id;
      v_merged := true;
    else
      select count(*) into v_count from tournament_participants where tournament_id = p_tournament;
      insert into tournament_participants (tournament_id, user_id, display_name, nickname, avatar_url, platform, gamer_id, avatar_color)
      values (p_tournament, u, coalesce(pr.nickname, pr.display_name), pr.nickname, pr.avatar_url, pr.platform, pr.gamer_id,
              (array['#7c3aed','#0ea5e9','#f97316','#ef4444','#14b8a6','#eab308','#ec4899','#22c55e','#6366f1','#f43f5e'])[v_count % 10 + 1])
      returning id into v_pid;
    end if;
    perform notify(p_tournament, v_pid, 'invitation', 'Te agregaron a un torneo', v_name);
    v_added := v_added + 1;
  end loop;
  -- Las estadísticas guardan la cuenta de cada jugador: se recalculan si un invitado pasó a ser cuenta
  if v_merged then perform recompute_player_stats(p_tournament); end if;
  return v_added;
end $$;

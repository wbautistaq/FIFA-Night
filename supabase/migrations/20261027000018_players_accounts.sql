-- FIFA Night · jugadores con cuenta: apodo único, "mis jugadores", búsqueda por apodo y alta directa en torneos
-- Los invitados siguen existiendo como excepción y pueden vincularse luego a una cuenta (desde el servidor).

-- Apodo único sin distinguir mayúsculas ni espacios de los extremos
create unique index profiles_nickname_uniq on profiles (lower(btrim(nickname))) where nickname is not null;

-- ¿Está libre ese apodo? (sin contar el propio)
create function nickname_available(p_nickname text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from profiles
     where nickname is not null and lower(btrim(nickname)) = lower(btrim(p_nickname))
       and id is distinct from auth.uid())
$$;
revoke all on function nickname_available(text) from public, anon;
grant execute on function nickname_available(text) to authenticated;

-- Personas con cuenta con las que ya compartí algún torneo (sin datos sensibles)
create function my_players() returns table (user_id uuid, nickname text, display_name text, avatar_url text, shared int, last_played timestamptz)
language sql stable security definer set search_path = public as $$
  select pr.id, pr.nickname, pr.display_name, pr.avatar_url, count(distinct other.tournament_id)::int, max(t.starts_at)
    from tournament_participants me
    join tournament_participants other on other.tournament_id = me.tournament_id and other.user_id is not null and other.user_id <> me.user_id
    join tournaments t on t.id = me.tournament_id and t.status <> 'cancelled'
    join profiles pr on pr.id = other.user_id
   where me.user_id = auth.uid()
   group by pr.id
   order by max(t.starts_at) desc, pr.nickname
   limit 60
$$;
revoke all on function my_players() from public, anon;
grant execute on function my_players() to authenticated;

-- Búsqueda por apodo: exacta o que empiece igual (mínimo 3 letras), pocos resultados.
-- Así se encuentra a alguien sabiendo su apodo, pero no se puede listar a todos los usuarios.
create function find_players(p_query text) returns table (user_id uuid, nickname text, display_name text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select id, nickname, display_name, avatar_url from profiles
   where nickname is not null and id <> auth.uid() and char_length(btrim(p_query)) >= 3
     and lower(nickname) like replace(replace(replace(lower(btrim(p_query)), '\', '\\'), '%', '\%'), '_', '\_') || '%'
   order by (lower(nickname) = lower(btrim(p_query))) desc, char_length(nickname), nickname
   limit 5
$$;
revoke all on function find_players(text) from public, anon;
grant execute on function find_players(text) to authenticated;

-- El organizador agrega jugadores con cuenta: entran directo y reciben un aviso
create function add_players(p_tournament uuid, p_users uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare v_name text; v_added int := 0; u uuid; pr profiles; v_pid uuid; v_count int;
begin
  if not is_organizer(p_tournament) then raise exception 'No autorizado' using errcode = '42501'; end if;
  select name into v_name from tournaments where id = p_tournament;
  foreach u in array coalesce(p_users, '{}') loop
    continue when exists (select 1 from tournament_participants where tournament_id = p_tournament and user_id = u);
    select * into pr from profiles where id = u;
    continue when not found;
    if exists (select 1 from tournament_participants where tournament_id = p_tournament
               and lower(display_name) = lower(coalesce(pr.nickname, pr.display_name))) then
      raise exception 'Ya hay un participante llamado %', coalesce(pr.nickname, pr.display_name) using errcode = 'P0001';
    end if;
    select count(*) into v_count from tournament_participants where tournament_id = p_tournament;
    insert into tournament_participants (tournament_id, user_id, display_name, nickname, avatar_url, platform, gamer_id, avatar_color)
    values (p_tournament, u, coalesce(pr.nickname, pr.display_name), pr.nickname, pr.avatar_url, pr.platform, pr.gamer_id,
            (array['#7c3aed','#0ea5e9','#f97316','#ef4444','#14b8a6','#eab308','#ec4899','#22c55e','#6366f1','#f43f5e'])[v_count % 10 + 1])
    returning id into v_pid;
    perform notify(p_tournament, v_pid, 'invitation', 'Te agregaron a un torneo', v_name);
    v_added := v_added + 1;
  end loop;
  return v_added;
end $$;
revoke all on function add_players(uuid, uuid[]) from public, anon;
grant execute on function add_players(uuid, uuid[]) to authenticated, service_role;

-- Amistosos sueltos y cierre manual de torneos sin calendario fijo
create policy matches_insert_friendly on matches for insert to authenticated
  with check (stage = 'friendly' and is_organizer(tournament_id)
              and (select status from tournaments where id = tournament_id) = 'in_progress'
              and (select format from tournaments where id = tournament_id) = 'friendlies');
create policy matches_delete_friendly on matches for delete to authenticated
  using (stage = 'friendly' and is_organizer(tournament_id) and status = 'pending');

create function finish_tournament(p_tournament uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_champ uuid;
begin
  if not is_organizer(p_tournament) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if (select status from tournaments where id = p_tournament) <> 'in_progress' then
    raise exception 'El torneo no está en curso' using errcode = 'P0001'; end if;
  if exists (select 1 from matches where tournament_id = p_tournament and status in ('pending','live','disputed')) then
    raise exception 'Hay partidos sin cerrar' using errcode = 'P0001'; end if;
  select participant_id into v_champ from standings where tournament_id = p_tournament order by position limit 1;
  update tournaments set status = 'finished', champion_participant_id = v_champ where id = p_tournament;
  perform recompute_player_stats(p_tournament);
  perform award_achievements(p_tournament);
  perform notify(p_tournament, pp.id, 'tournament_finished', 'Torneo finalizado',
                 'El campeón es ' || coalesce((select display_name from tournament_participants where id = v_champ), '—'))
     from tournament_participants pp where pp.tournament_id = p_tournament;
end $$;
revoke all on function finish_tournament(uuid) from public, anon;
grant execute on function finish_tournament(uuid) to authenticated, service_role;

-- Duplicar torneo (configuración, jugadores y banco de equipos propio)
create function duplicate_tournament(p_tournament uuid, p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_new uuid;
begin
  if not is_organizer(p_tournament) then raise exception 'No autorizado' using errcode = '42501'; end if;
  insert into tournaments (owner_id, name, starts_at, platform, format, max_players, rules, settings, duplicated_from, status)
  select auth.uid(), p_name, now() + interval '7 days', platform, format, max_players, rules, settings, id, 'draft'
    from tournaments where id = p_tournament returning id into v_new;
  insert into fifa_teams (tournament_id, name, short_name, league, country, rating, kind, color_primary, color_secondary, banned, favorite)
  select v_new, name, short_name, league, country, rating, kind, color_primary, color_secondary, banned, favorite
    from fifa_teams where tournament_id = p_tournament;
  return v_new;
end $$;
revoke all on function duplicate_tournament(uuid, text) from public, anon;
grant execute on function duplicate_tournament(uuid, text) to authenticated;

-- Cobertura del partido: marcar en juego (organizador)
create function set_match_live(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m matches;
begin
  select * into m from matches where id = p_match;
  if not found or not is_organizer(m.tournament_id) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if m.status <> 'pending' or m.home_id is null or m.away_id is null then
    raise exception 'El partido no puede iniciarse' using errcode = 'P0001'; end if;
  update matches set status = 'live' where id = p_match;
end $$;
revoke all on function set_match_live(uuid) from public, anon;
grant execute on function set_match_live(uuid) to authenticated, service_role;

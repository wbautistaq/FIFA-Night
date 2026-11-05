-- FIFA Night · amistosos sin cierre automático, resultado con penales en los avisos y apodos en todo el torneo

create or replace function check_tournament_finished(p_tournament uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_status tournament_status; v_format tournament_format; v_open int; v_champ uuid; v_total int; v_rounds int;
begin
  select status, format, coalesce((settings->>'swiss_rounds')::int, 3) into v_status, v_format, v_rounds from tournaments where id = p_tournament;
  if v_status <> 'in_progress' then return; end if;
  -- Los amistosos no tienen un final fijo: el organizador los cierra con «Cerrar torneo»
  if v_format = 'friendlies' then return; end if;
  select count(*) filter (where status not in ('finished','cancelled')), count(*)
    into v_open, v_total from matches where tournament_id = p_tournament;
  if v_total = 0 or v_open > 0 then return; end if;
  if v_format::text = 'swiss' and (select coalesce(max(round), 0) from matches where tournament_id = p_tournament) < v_rounds then return; end if;

  if v_format in ('league','league_double') or v_format::text = 'swiss' then
    select participant_id into v_champ from standings where tournament_id = p_tournament order by position limit 1;
  elsif v_format = 'cup' or v_format = 'groups_playoffs' then
    select winner_id into v_champ from matches
     where tournament_id = p_tournament and stage = 'knockout' and next_match_id is null and winner_id is not null
     order by round desc limit 1;
  elsif v_format = 'double_elimination' then
    select winner_id into v_champ from matches where tournament_id = p_tournament and stage = 'grand_final' limit 1;
  else
    select participant_id into v_champ from standings where tournament_id = p_tournament order by position limit 1;
  end if;

  update tournaments set status = 'finished', champion_participant_id = v_champ where id = p_tournament;
  perform recompute_player_stats(p_tournament);
  perform award_achievements(p_tournament);
  perform notify(p_tournament, pp.id, 'tournament_finished', 'Torneo finalizado',
                 'El campeón es ' || coalesce((select display_name from tournament_participants where id = v_champ), '—'))
     from tournament_participants pp where pp.tournament_id = p_tournament;
end $$;

create or replace function process_match(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  m matches; r match_results; v_winner uuid; v_loser uuid; v_old_winner uuid;
  v_tid uuid; v_score text;
begin
  select * into m from matches where id = p_match;
  if not found then return; end if;
  v_tid := m.tournament_id;
  select * into r from match_results where match_id = p_match;
  v_old_winner := m.winner_id;

  if found then
    v_score := coalesce((select display_name from tournament_participants where id = m.home_id), 'Local')
            || ' ' || r.home_score || ' - ' || r.away_score || ' '
            || coalesce((select display_name from tournament_participants where id = m.away_id), 'Visitante');
    if r.home_pens is not null and r.away_pens is not null then
      v_score := v_score || ' (penales ' || r.home_pens || '-' || r.away_pens || ')';
    end if;
  end if;

  if found and r.status = 'confirmed' then
    v_winner := result_winner(r, m);
    if is_knockout_stage(m.stage) and v_winner is null then
      raise exception 'Un partido eliminatorio no puede terminar empatado: registra los penales' using errcode = 'P0001';
    end if;
    v_loser := case when v_winner = m.home_id then m.away_id else m.home_id end;

    -- No permitir corregir si el ganador cambia y el siguiente partido ya fue jugado
    if is_knockout_stage(m.stage) and v_old_winner is not null and v_old_winner <> v_winner then
      if exists (select 1 from matches n join match_results nr on nr.match_id = n.id and nr.status = 'confirmed'
                  where n.id in (m.next_match_id, m.loser_next_match_id)) then
        raise exception 'No se puede corregir: el siguiente partido ya tiene resultado' using errcode = 'P0001';
      end if;
    end if;

    update matches set winner_id = v_winner, status = 'finished' where id = p_match;
    if is_knockout_stage(m.stage) then
      perform push_to_slot(m.next_match_id, m.next_slot, v_winner, false);
      perform push_to_slot(m.loser_next_match_id, m.loser_next_slot, v_loser, false);
    end if;
    perform notify(v_tid, pp, 'result_confirmed', 'Resultado confirmado', v_score)
       from unnest(array[m.home_id, m.away_id]) pp where pp is not null;
  else
    -- Resultado ausente, reportado o en disputa: no afecta tabla ni bracket
    if v_old_winner is not null and is_knockout_stage(m.stage) then
      if exists (select 1 from matches n join match_results nr on nr.match_id = n.id and nr.status = 'confirmed'
                  where n.id in (m.next_match_id, m.loser_next_match_id)) then
        raise exception 'No se puede anular: el siguiente partido ya tiene resultado' using errcode = 'P0001';
      end if;
      perform push_to_slot(m.next_match_id, m.next_slot, null, false);
      perform push_to_slot(m.loser_next_match_id, m.loser_next_slot, null, false);
    end if;
    update matches set winner_id = null,
      status = case when found and r.status = 'disputed' then 'disputed'::match_status
                    when m.status = 'live' then 'live'::match_status
                    else 'pending'::match_status end
     where id = p_match;
    if found and r.status = 'reported' then
      perform notify(v_tid, case when r.reported_by = m.home_id then m.away_id else m.home_id end,
                     'result_reported', 'Resultado reportado', 'Tu rival reportó ' || v_score || '. Confírmalo o dispútalo.');
    end if;
  end if;

  if is_knockout_stage(m.stage) then perform resolve_byes(v_tid); end if;
  if m.stage in ('league','group','friendly') then
    perform recompute_standings(v_tid);
    if m.stage = 'group' then perform fill_playoffs(v_tid); end if;
  end if;
  perform settle_predictions(v_tid);
  perform recompute_player_stats(v_tid);
  perform check_tournament_finished(v_tid);
end $$;

-- Dentro de un torneo cada jugador se muestra con su apodo; el nombre real queda en su perfil.
create function participant_public_name() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_nick text;
begin
  v_nick := nullif(trim(coalesce(new.nickname, '')), '');
  if v_nick is null and new.user_id is not null then
    select nullif(trim(coalesce(nickname, '')), '') into v_nick from profiles where id = new.user_id;
    new.nickname := v_nick;
  end if;
  if v_nick is not null then new.display_name := v_nick; end if;
  return new;
end $$;
revoke all on function participant_public_name() from public, anon, authenticated;
create trigger participants_public_name before insert or update of display_name, nickname
  on tournament_participants for each row execute function participant_public_name();

-- Corrige los torneos existentes, sin chocar con otro participante que ya use ese nombre
update tournament_participants p
   set display_name = pr.nickname, nickname = pr.nickname
  from profiles pr
 where pr.id = p.user_id and nullif(trim(coalesce(pr.nickname, '')), '') is not null
   and p.display_name is distinct from pr.nickname
   and not exists (select 1 from tournament_participants o
                    where o.tournament_id = p.tournament_id and o.id <> p.id
                      and norm_name(o.display_name) = norm_name(pr.nickname));

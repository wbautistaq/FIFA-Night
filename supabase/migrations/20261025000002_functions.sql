-- FIFA Night · lógica de negocio en PostgreSQL

alter table matches add column home_seed int, add column away_seed int,
  add column home_empty boolean not null default false,
  add column away_empty boolean not null default false;
alter table match_results add column comeback_by uuid references tournament_participants(id) on delete set null;

-- ───────── utilidades ─────────
create function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger profiles_touch before update on profiles for each row execute function touch_updated_at();
create trigger tournaments_touch before update on tournaments for each row execute function touch_updated_at();
create trigger match_results_touch before update on match_results for each row execute function touch_updated_at();

create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'full_name',''), nullif(split_part(new.email,'@',1),''), 'Jugador'))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

create function notify(p_tournament uuid, p_participant uuid, p_kind text, p_title text, p_body text default '')
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  select user_id into v_user from tournament_participants where id = p_participant;
  insert into notifications (tournament_id, user_id, participant_id, kind, title, body)
  values (p_tournament, v_user, p_participant, p_kind, p_title, p_body);
end $$;

-- Ganador de un resultado confirmado (null = empate sin penales)
create function result_winner(r match_results, m matches) returns uuid language sql immutable as $$
  select case
    when r.home_score > r.away_score then m.home_id
    when r.home_score < r.away_score then m.away_id
    when r.home_pens is not null and r.home_pens > r.away_pens then m.home_id
    when r.home_pens is not null and r.home_pens < r.away_pens then m.away_id
    else null end
$$;

create function is_knockout_stage(s match_stage) returns boolean language sql immutable as $$
  select s in ('knockout','winners','losers','grand_final','third_place')
$$;

-- ───────── tabla de posiciones ─────────
create function recompute_standings(p_tournament uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_old_leader uuid;
  v_new_leader uuid;
  v_group text;
begin
  select participant_id into v_old_leader from standings
   where tournament_id = p_tournament and position = 1 and played > 0
   order by group_name limit 1;

  delete from standings where tournament_id = p_tournament;

  insert into standings (tournament_id, participant_id, group_name, played, won, drawn, lost,
                         goals_for, goals_against, goal_difference, points)
  select p.tournament_id, p.id, coalesce(p.group_name, ''),
         count(x.mid)::int,
         count(*) filter (where x.gf > x.ga)::int,
         count(*) filter (where x.gf = x.ga)::int,
         count(*) filter (where x.gf < x.ga)::int,
         coalesce(sum(x.gf),0)::int, coalesce(sum(x.ga),0)::int,
         (coalesce(sum(x.gf),0) - coalesce(sum(x.ga),0))::int,
         (3 * count(*) filter (where x.gf > x.ga) + count(*) filter (where x.gf = x.ga))::int
  from tournament_participants p
  left join lateral (
    select m.id as mid, r.home_score as gf, r.away_score as ga
      from matches m join match_results r on r.match_id = m.id and r.status = 'confirmed'
     where m.tournament_id = p.tournament_id and m.stage in ('league','group','friendly') and m.home_id = p.id
    union all
    select m.id, r.away_score, r.home_score
      from matches m join match_results r on r.match_id = m.id and r.status = 'confirmed'
     where m.tournament_id = p.tournament_id and m.stage in ('league','group','friendly') and m.away_id = p.id
  ) x on true
  where p.tournament_id = p_tournament
  group by p.tournament_id, p.id, p.group_name;

  -- Posiciones con desempates configurables (el orden viene de settings.tiebreakers)
  with settings as (
    select coalesce(t.settings->'tiebreakers', '["points","goal_difference","goals_for","head_to_head","alphabetical"]'::jsonb) as tb
      from tournaments t where t.id = p_tournament
  ),
  h2h as (
    select s.participant_id,
           coalesce((
             select sum(case when (m.home_id = s.participant_id and r.home_score > r.away_score)
                               or (m.away_id = s.participant_id and r.away_score > r.home_score) then 3
                             when r.home_score = r.away_score then 1 else 0 end)
               from matches m join match_results r on r.match_id = m.id and r.status = 'confirmed'
              where m.tournament_id = s.tournament_id and m.stage in ('league','group','friendly')
                and ((m.home_id = s.participant_id and m.away_id in (select s2.participant_id from standings s2
                       where s2.tournament_id = s.tournament_id and s2.group_name = s.group_name and s2.points = s.points and s2.participant_id <> s.participant_id))
                  or (m.away_id = s.participant_id and m.home_id in (select s2.participant_id from standings s2
                       where s2.tournament_id = s.tournament_id and s2.group_name = s.group_name and s2.points = s.points and s2.participant_id <> s.participant_id)))
           ), 0) as pts
      from standings s where s.tournament_id = p_tournament
  ),
  keyed as (
    select s.participant_id, s.group_name, tp.display_name,
           array(select case c.crit
                          when 'points' then s.points
                          when 'goal_difference' then s.goal_difference
                          when 'goals_for' then s.goals_for
                          when 'head_to_head' then h.pts
                          else 0 end
                   from jsonb_array_elements_text((select tb from settings)) with ordinality as c(crit, ord)
                  order by c.ord)::int[] as keys
      from standings s
      join tournament_participants tp on tp.id = s.participant_id
      join h2h h on h.participant_id = s.participant_id
     where s.tournament_id = p_tournament
  ),
  ranked as (
    select participant_id,
           row_number() over (partition by group_name order by keys desc, lower(display_name) asc) as pos
      from keyed
  )
  update standings s set position = r.pos, updated_at = now()
    from ranked r where s.tournament_id = p_tournament and s.participant_id = r.participant_id;

  select participant_id into v_new_leader from standings
   where tournament_id = p_tournament and position = 1 and played > 0
   order by group_name limit 1;
  if v_new_leader is not null and v_new_leader is distinct from v_old_leader and v_old_leader is not null then
    perform notify(p_tournament, pp.id, 'new_leader', 'Nuevo líder',
                   (select display_name from tournament_participants where id = v_new_leader) || ' toma la cima de la tabla')
       from tournament_participants pp where pp.tournament_id = p_tournament;
  end if;
end $$;

-- ───────── brackets: byes y avance ─────────
create function push_to_slot(p_match uuid, p_slot text, p_participant uuid, p_empty boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_match is null then return; end if;
  if p_slot = 'home' then
    update matches set home_id = p_participant, home_empty = p_empty where id = p_match;
  else
    update matches set away_id = p_participant, away_empty = p_empty where id = p_match;
  end if;
end $$;

-- Resuelve partidos con un lado que nunca se llenará (byes) hasta punto fijo
create function resolve_byes(p_tournament uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m matches; v_changed boolean := true; v_guard int := 0;
begin
  while v_changed and v_guard < 200 loop
    v_changed := false; v_guard := v_guard + 1;
    for m in select * from matches
              where tournament_id = p_tournament and status = 'pending' and is_knockout_stage(stage)
                and (home_empty or away_empty) loop
      if m.home_empty and m.away_empty then
        update matches set status = 'cancelled', is_bye = true where id = m.id;
        perform push_to_slot(m.next_match_id, m.next_slot, null, true);
        perform push_to_slot(m.loser_next_match_id, m.loser_next_slot, null, true);
        v_changed := true;
      elsif (m.home_empty and m.away_id is not null) or (m.away_empty and m.home_id is not null) then
        update matches set status = 'finished', is_bye = true,
               winner_id = coalesce(m.home_id, m.away_id) where id = m.id;
        perform push_to_slot(m.next_match_id, m.next_slot, coalesce(m.home_id, m.away_id), false);
        perform push_to_slot(m.loser_next_match_id, m.loser_next_slot, null, true);
        v_changed := true;
      end if;
    end loop;
  end loop;
end $$;

-- Llena los playoffs de grupos + playoffs con los clasificados
create function fill_playoffs(p_tournament uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_q int; v_pending int; v_filled int;
begin
  select coalesce((settings->>'qualifiers_per_group')::int, 2) into v_q from tournaments where id = p_tournament;
  select count(*) into v_pending from matches
   where tournament_id = p_tournament and stage = 'group' and status not in ('finished','cancelled');
  if v_pending > 0 then return; end if;
  select count(*) into v_filled from matches
   where tournament_id = p_tournament and stage = 'knockout' and round = 1 and (home_id is not null or away_id is not null);
  if v_filled > 0 then return; end if;

  with qualified as (
    select s.participant_id,
           row_number() over (order by s.position asc, s.points desc, s.goal_difference desc, s.goals_for desc, s.group_name asc) as seed
      from standings s where s.tournament_id = p_tournament and s.position <= v_q
  )
  update matches m set
    home_id = (select participant_id from qualified where seed = m.home_seed),
    away_id = (select participant_id from qualified where seed = m.away_seed),
    home_empty = not exists (select 1 from qualified where seed = m.home_seed),
    away_empty = not exists (select 1 from qualified where seed = m.away_seed)
  where m.tournament_id = p_tournament and m.stage = 'knockout' and m.round = 1;

  perform resolve_byes(p_tournament);
  perform notify(p_tournament, pp.id, 'playoffs_start', 'Comienza la fase final', 'Ya están definidos los clasificados')
     from tournament_participants pp where pp.tournament_id = p_tournament;
end $$;

-- ───────── estadísticas, puntos, logros ─────────
create function recompute_player_stats(p_tournament uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_fp boolean;
  v_champion uuid;
  p record; x record;
  v_streak int; v_best int; v_pts int;
begin
  select coalesce((settings->>'fifa_points')::boolean, true), champion_participant_id
    into v_fp, v_champion from tournaments where id = p_tournament;

  delete from player_stats where tournament_id = p_tournament;
  insert into player_stats (tournament_id, participant_id, user_id)
  select tournament_id, id, user_id from tournament_participants where tournament_id = p_tournament;

  for p in select id from tournament_participants where tournament_id = p_tournament loop
    v_streak := 0; v_best := 0; v_pts := 0;
    for x in
      select m.id, m.mvp_id, r.played_at,
             case when m.home_id = p.id then r.home_score else r.away_score end as gf,
             case when m.home_id = p.id then r.away_score else r.home_score end as ga,
             case when m.home_id = p.id then r.home_pens else r.away_pens end as pf,
             case when m.home_id = p.id then r.away_pens else r.home_pens end as pa,
             case when m.home_id = p.id then r.fair_play_home else r.fair_play_away end as fp,
             (r.comeback_by = p.id) as comeback,
             (select t.rating from team_assignments a join fifa_teams t on t.id = a.team_id
               where a.participant_id = p.id) as my_rating,
             (select t.rating from team_assignments a join fifa_teams t on t.id = a.team_id
               where a.participant_id = case when m.home_id = p.id then m.away_id else m.home_id end) as opp_rating
        from matches m join match_results r on r.match_id = m.id and r.status = 'confirmed'
       where m.tournament_id = p_tournament and (m.home_id = p.id or m.away_id = p.id)
       order by r.played_at, m.created_at
    loop
      declare v_win boolean := x.gf > x.ga or (x.gf = x.ga and x.pf is not null and x.pf > x.pa);
              v_loss boolean := x.gf < x.ga or (x.gf = x.ga and x.pf is not null and x.pf < x.pa);
              v_draw boolean := not (x.gf > x.ga or x.gf < x.ga) and x.pf is null;
      begin
        update player_stats set
          played = played + 1,
          won = won + case when x.gf > x.ga then 1 else 0 end,
          lost = lost + case when x.gf < x.ga then 1 else 0 end,
          drawn = drawn + case when x.gf = x.ga then 1 else 0 end,
          goals_for = goals_for + x.gf, goals_against = goals_against + x.ga,
          clean_sheets = clean_sheets + case when x.ga = 0 then 1 else 0 end,
          biggest_win = greatest(biggest_win, x.gf - x.ga),
          biggest_loss = greatest(biggest_loss, x.ga - x.gf),
          mvp_count = mvp_count + case when x.mvp_id = p.id then 1 else 0 end,
          fair_play_points = fair_play_points + x.fp
        where tournament_id = p_tournament and participant_id = p.id;

        if v_win then v_streak := greatest(v_streak, 0) + 1;
        elsif v_loss then v_streak := least(v_streak, 0) - 1;
        else v_streak := 0; end if;
        v_best := greatest(v_best, v_streak);

        v_pts := v_pts + case when x.gf > x.ga then 3 when x.gf = x.ga and x.pf is not null and x.pf > x.pa then 3
                              when x.gf = x.ga and x.pf is null then 1 else 0 end
                       + x.gf
                       + case when x.ga = 0 then 2 else 0 end
                       + case when x.comeback and v_win then 2 else 0 end
                       + case when v_win and x.my_rating is not null and x.opp_rating is not null and x.my_rating < x.opp_rating then 2 else 0 end
                       + case when x.pf is not null and v_win then 1 else 0 end
                       + case when x.pf is not null and v_loss then 1 else 0 end
                       + case when x.mvp_id = p.id then 3 else 0 end;
      end;
    end loop;
    update player_stats set current_streak = v_streak, best_streak = v_best,
           fifa_points = case when v_fp then v_pts + case when p.id = v_champion then 10 else 0 end else 0 end,
           champion = coalesce(p.id = v_champion, false)
     where tournament_id = p_tournament and participant_id = p.id;
  end loop;
end $$;

create function award_achievements(p_tournament uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_champion uuid; v_user uuid;
begin
  select champion_participant_id into v_champion from tournaments where id = p_tournament;
  delete from achievements where tournament_id = p_tournament;

  if v_champion is not null then
    select user_id into v_user from tournament_participants where id = v_champion;
    if v_user is null or not exists (
      select 1 from player_stats ps join tournaments t on t.id = ps.tournament_id
       where ps.user_id = v_user and ps.champion and ps.tournament_id <> p_tournament
    ) then
      insert into achievements (tournament_id, participant_id, code) values (p_tournament, v_champion, 'first_title');
    end if;
  end if;

  insert into achievements (tournament_id, participant_id, code)
  select p_tournament, participant_id, 'top_scorer' from player_stats
   where tournament_id = p_tournament and goals_for > 0
     and goals_for = (select max(goals_for) from player_stats where tournament_id = p_tournament);
  insert into achievements (tournament_id, participant_id, code)
  select p_tournament, participant_id, 'unbeaten' from player_stats
   where tournament_id = p_tournament and played > 0 and lost = 0;
  insert into achievements (tournament_id, participant_id, code)
  select p_tournament, participant_id, 'clasico_king' from player_stats
   where tournament_id = p_tournament and biggest_win > 0
     and biggest_win = (select max(biggest_win) from player_stats where tournament_id = p_tournament);
  insert into achievements (tournament_id, participant_id, code)
  select p_tournament, participant_id, 'worst_defense' from player_stats
   where tournament_id = p_tournament and goals_against > 0
     and goals_against = (select max(goals_against) from player_stats where tournament_id = p_tournament);
  insert into achievements (tournament_id, participant_id, code)
  select p_tournament, participant_id, 'fair_play' from player_stats
   where tournament_id = p_tournament and played > 0
     and fair_play_points = (select min(fair_play_points) from player_stats where tournament_id = p_tournament and played > 0);
  insert into achievements (tournament_id, participant_id, code)
  select p_tournament, w, 'penalty_specialist' from (
    select (case when r.home_pens > r.away_pens then m.home_id else m.away_id end) as w, count(*) c
      from matches m join match_results r on r.match_id = m.id and r.status = 'confirmed'
     where m.tournament_id = p_tournament and r.home_pens is not null group by 1
  ) s where c = (select max(c2) from (
      select count(*) c2 from matches m join match_results r on r.match_id = m.id and r.status = 'confirmed'
       where m.tournament_id = p_tournament and r.home_pens is not null
       group by (case when r.home_pens > r.away_pens then m.home_id else m.away_id end)) z);
  insert into achievements (tournament_id, participant_id, code)
  select p_tournament, comeback_by, 'comeback_kid' from (
    select r.comeback_by, count(*) c from matches m join match_results r on r.match_id = m.id and r.status = 'confirmed'
     where m.tournament_id = p_tournament and r.comeback_by is not null group by 1
  ) s where c = (select max(c2) from (
      select count(*) c2 from matches m join match_results r on r.match_id = m.id and r.status = 'confirmed'
       where m.tournament_id = p_tournament and r.comeback_by is not null group by r.comeback_by) z);
end $$;

-- ───────── predicciones ─────────
create function settle_predictions(p_tournament uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_exact boolean;
begin
  select coalesce((settings->>'exact_score_predictions')::boolean, true) into v_exact from tournaments where id = p_tournament;
  update predictions p set
    settled = (r.status = 'confirmed'),
    points = case when r.status <> 'confirmed' then 0 else
      (case when p.predicted_winner_id is not distinct from result_winner(r, m) then 3 else 0 end)
      + (case when v_exact and p.home_score = r.home_score and p.away_score = r.away_score then 2 else 0 end) end
  from matches m left join match_results r on r.match_id = m.id
  where p.match_id = m.id and p.tournament_id = p_tournament;
end $$;

-- ───────── fin de torneo ─────────
create function check_tournament_finished(p_tournament uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_status tournament_status; v_format tournament_format; v_open int; v_champ uuid; v_total int;
begin
  select status, format into v_status, v_format from tournaments where id = p_tournament;
  if v_status <> 'in_progress' then return; end if;
  select count(*) filter (where status not in ('finished','cancelled')), count(*)
    into v_open, v_total from matches where tournament_id = p_tournament;
  if v_total = 0 or v_open > 0 then return; end if;

  if v_format in ('league','league_double') then
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

-- ───────── procesamiento de un resultado ─────────
create function process_match(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  m matches; r match_results; v_winner uuid; v_loser uuid; v_next matches; v_old_winner uuid;
  v_tid uuid; v_prev matches;
begin
  select * into m from matches where id = p_match;
  if not found then return; end if;
  v_tid := m.tournament_id;
  select * into r from match_results where match_id = p_match;
  v_old_winner := m.winner_id;

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
    perform notify(v_tid, pp, 'result_confirmed', 'Resultado confirmado',
                   r.home_score || ' - ' || r.away_score)
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
                     'result_reported', 'Resultado reportado', 'Tu rival reportó ' || r.home_score || ' - ' || r.away_score);
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

create function on_match_result_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform process_match(coalesce(new.match_id, old.match_id));
  return null;
end $$;
create trigger match_results_after after insert or update or delete on match_results
  for each row execute function on_match_result_change();

-- ───────── sorteo y fixtures (RPC atómicos para el organizador) ─────────
create function is_organizer(p_tournament uuid, p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from tournaments t where t.id = p_tournament and t.owner_id = p_user)
      or exists (select 1 from tournament_participants tp
                  where tp.tournament_id = p_tournament and tp.user_id = p_user and tp.role = 'coorganizer')
$$;

create function confirm_draw(p_tournament uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_organizer(p_tournament) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if (select status from tournaments where id = p_tournament) not in ('registration','draw') then
    raise exception 'El torneo no admite sorteo en este estado' using errcode = 'P0001'; end if;
  if exists (select 1 from tournament_participants p where p.tournament_id = p_tournament
              and not exists (select 1 from team_assignments a where a.participant_id = p.id)) then
    raise exception 'Todos los participantes deben tener un equipo asignado' using errcode = 'P0001'; end if;
  update team_assignments set confirmed = true where tournament_id = p_tournament;
  update tournaments set draw_confirmed = true, status = 'draw' where id = p_tournament;
  perform notify(p_tournament, pp.id, 'draw_done', 'Sorteo realizado', 'Ya tienes equipo asignado')
     from tournament_participants pp where pp.tournament_id = p_tournament;
end $$;

-- Guarda fixtures generados por el motor TypeScript y arranca el torneo
create function start_tournament(p_tournament uuid, p_matches jsonb, p_brackets jsonb default '[]'::jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_organizer(p_tournament) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if (select status from tournaments where id = p_tournament) not in ('registration','draw') then
    raise exception 'El torneo ya fue iniciado o cerrado' using errcode = 'P0001'; end if;
  if (select count(*) from tournament_participants where tournament_id = p_tournament) < 4 then
    raise exception 'Se necesitan al menos 4 participantes' using errcode = 'P0001'; end if;

  delete from matches where tournament_id = p_tournament;
  delete from brackets where tournament_id = p_tournament;

  insert into matches (id, tournament_id, stage, group_name, round, position, leg, home_id, away_id,
                       next_match_id, next_slot, loser_next_match_id, loser_next_slot,
                       home_seed, away_seed, home_empty, away_empty)
  select (e->>'id')::uuid, p_tournament, (e->>'stage')::match_stage, nullif(e->>'group_name',''),
         coalesce((e->>'round')::int,1), coalesce((e->>'position')::int,1), coalesce((e->>'leg')::int,1),
         nullif(e->>'home_id','')::uuid, nullif(e->>'away_id','')::uuid,
         nullif(e->>'next_match_id','')::uuid, nullif(e->>'next_slot',''),
         nullif(e->>'loser_next_match_id','')::uuid, nullif(e->>'loser_next_slot',''),
         nullif(e->>'home_seed','')::int, nullif(e->>'away_seed','')::int,
         coalesce((e->>'home_empty')::boolean,false), coalesce((e->>'away_empty')::boolean,false)
    from jsonb_array_elements(p_matches) e;

  insert into brackets (tournament_id, kind, rounds, has_third_place)
  select p_tournament, e->>'kind', (e->>'rounds')::int, coalesce((e->>'has_third_place')::boolean,false)
    from jsonb_array_elements(p_brackets) e;

  update tournaments set status = 'in_progress' where id = p_tournament;
  perform recompute_standings(p_tournament);
  perform resolve_byes(p_tournament);
  perform recompute_player_stats(p_tournament);
  perform notify(p_tournament, pp.id, 'match_pending', 'Calendario listo', 'Revisa tus partidos pendientes')
     from tournament_participants pp where pp.tournament_id = p_tournament;
end $$;

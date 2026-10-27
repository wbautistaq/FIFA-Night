-- FIFA Night · estadísticas y logros coherentes
-- 1) Una tanda de penales decide: cuenta como victoria/derrota en el récord del jugador, igual que ya
--    contaba en la racha y en los puntos FIFA (antes el récord la anotaba como empate). Con eso el logro
--    «Invicto» deja de premiar a quien perdió por penales. La tabla de liga/grupos no cambia (ahí un
--    empate con penales sigue valiendo 1 punto, como en el reglamento).
-- 2) «Fair play» solo se otorga si alguien sumó puntos de juego sucio; si todos tienen 0, nadie lo gana.
-- 3) Recalcula las estadísticas de todos los torneos y los logros de los finalizados.

create or replace function recompute_player_stats(p_tournament uuid) returns void
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
              v_draw boolean := not v_win and not v_loss;
      begin
        update player_stats set
          played = played + 1,
          won = won + case when v_win then 1 else 0 end,
          lost = lost + case when v_loss then 1 else 0 end,
          drawn = drawn + case when v_draw then 1 else 0 end,
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

create or replace function award_achievements(p_tournament uuid) returns void
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
     and fair_play_points = (select min(fair_play_points) from player_stats where tournament_id = p_tournament and played > 0)
     -- Si nadie registró juego sucio, todos empatan en 0 y el logro no distingue a nadie
     and (select count(distinct fair_play_points) from player_stats where tournament_id = p_tournament and played > 0) > 1;
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

do $$
declare t record;
begin
  for t in select id, status from tournaments where exists (select 1 from matches m where m.tournament_id = tournaments.id) loop
    perform recompute_player_stats(t.id);
    if t.status = 'finished' then perform award_achievements(t.id); end if;
  end loop;
end $$;

-- FIFA Night · endurecimiento y rendimiento (avisos de los advisors de Supabase)

-- ───────── Funciones auxiliares fuera de la API pública ─────────
-- Las usan las policies (rol authenticated); anon no debe poder consultarlas por /rpc
revoke all on function is_member(uuid, uuid), is_organizer(uuid, uuid), my_participant(uuid),
  shares_tournament(uuid), tournament_editable(uuid) from public, anon;
grant execute on function is_member(uuid, uuid), is_organizer(uuid, uuid), my_participant(uuid),
  shares_tournament(uuid), tournament_editable(uuid) to authenticated, service_role;

-- Funciones de trigger: Postgres no comprueba EXECUTE al dispararlas, así que nadie necesita llamarlas
revoke all on function handle_new_user(), on_match_result_change(), guard_participant_insert(),
  guard_result_insert(), guard_result_update(), guard_tournament_update(), guard_participant_update(),
  touch_updated_at() from public, anon, authenticated;

-- ───────── search_path fijo ─────────
alter function touch_updated_at() set search_path = public;
alter function result_winner(match_results, matches) set search_path = public;
alter function is_knockout_stage(match_stage) set search_path = public;
alter function guard_tournament_update() set search_path = public;
alter function guard_participant_update() set search_path = public;

-- auth.role() está obsoleto: el rol viene en los claims del JWT
create or replace function is_service() returns boolean language sql stable set search_path = public as $$
  select coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'service_role'
$$;

-- ───────── Policies: auth.uid() evaluado una vez por consulta, no por fila ─────────
alter policy profiles_insert on profiles with check (id = (select auth.uid()));
alter policy profiles_update on profiles using (id = (select auth.uid())) with check (id = (select auth.uid()));
alter policy tournaments_select on tournaments using (owner_id = (select auth.uid()) or is_member(id));
alter policy tournaments_insert on tournaments with check (owner_id = (select auth.uid()) and status = 'draft');
alter policy tournaments_delete on tournaments using (owner_id = (select auth.uid()) and status = 'draft');
alter policy participants_update on tournament_participants
  using (is_organizer(tournament_id) or user_id = (select auth.uid()))
  with check (is_organizer(tournament_id) or user_id = (select auth.uid()));
alter policy invitations_all on invitations
  using (is_organizer(tournament_id)) with check (is_organizer(tournament_id) and created_by = (select auth.uid()));
alter policy stats_select on player_stats using (is_member(tournament_id) or user_id = (select auth.uid()));
alter policy posts_insert on tournament_posts
  with check (author_participant_id = my_participant(tournament_id)
              or (is_organizer(tournament_id) and exists (select 1 from tournament_participants p where p.id = author_participant_id and p.tournament_id = tournament_posts.tournament_id and p.user_id = (select auth.uid()))));
alter policy notifications_select on notifications using (user_id = (select auth.uid()));
alter policy notifications_update on notifications using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- assignments_write era FOR ALL y duplicaba la policy de lectura: una por acción
drop policy assignments_write on team_assignments;
create policy assignments_insert on team_assignments for insert to authenticated
  with check (is_organizer(tournament_id) and tournament_editable(tournament_id) and not (select draw_confirmed from tournaments where id = tournament_id));
create policy assignments_update on team_assignments for update to authenticated
  using (is_organizer(tournament_id) and tournament_editable(tournament_id) and not (select draw_confirmed from tournaments where id = tournament_id))
  with check (is_organizer(tournament_id) and tournament_editable(tournament_id) and not (select draw_confirmed from tournaments where id = tournament_id));
create policy assignments_delete on team_assignments for delete to authenticated
  using (is_organizer(tournament_id) and tournament_editable(tournament_id) and not (select draw_confirmed from tournaments where id = tournament_id));

-- ───────── Índices para claves foráneas ─────────
create index if not exists participants_user_idx on tournament_participants(user_id);
create index if not exists team_assignments_participant_idx on team_assignments(participant_id);
create index if not exists team_assignments_team_idx on team_assignments(team_id);
create index if not exists notifications_tournament_idx on notifications(tournament_id);
create index if not exists standings_participant_idx on standings(participant_id);
create index if not exists player_stats_participant_idx on player_stats(participant_id);
create index if not exists predictions_participant_idx on predictions(participant_id);
create index if not exists predictions_winner_idx on predictions(predicted_winner_id);
create index if not exists achievements_participant_idx on achievements(participant_id);
create index if not exists post_reactions_participant_idx on post_reactions(participant_id);
create index if not exists tournament_posts_author_idx on tournament_posts(author_participant_id);
create index if not exists invitations_created_by_idx on invitations(created_by);
create index if not exists match_results_reported_by_idx on match_results(reported_by);
create index if not exists match_results_confirmed_by_idx on match_results(confirmed_by);
create index if not exists match_results_comeback_by_idx on match_results(comeback_by);
create index if not exists matches_next_idx on matches(next_match_id);
create index if not exists matches_loser_next_idx on matches(loser_next_match_id);
create index if not exists matches_winner_idx on matches(winner_id);
create index if not exists matches_mvp_idx on matches(mvp_id);
create index if not exists tournaments_champion_idx on tournaments(champion_participant_id);
create index if not exists tournaments_duplicated_from_idx on tournaments(duplicated_from);

-- ───────── Storage ─────────
-- El bucket es público: las URLs se sirven sin policy de lectura, y esta permitía listar todos los archivos
drop policy if exists "fifa_night_read" on storage.objects;

-- ───────── Notificaciones de resultados con nombres ("Ana 2 - 1 Beto") ─────────
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
revoke all on function process_match(uuid) from public, anon, authenticated;

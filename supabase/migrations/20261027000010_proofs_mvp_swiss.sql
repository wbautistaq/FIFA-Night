-- FIFA Night · foto del marcador, MVP votado por los jugadores y sistema suizo

-- ───────── Foto del marcador ─────────
-- Tabla aparte de match_results: subir o cambiar la foto no debe volver a procesar el resultado.
-- Se escribe solo desde el servidor (acción validada con el token o la sesión); los miembros la leen.
create table match_proofs (
  match_id uuid primary key references matches(id) on delete cascade,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  url text not null check (char_length(url) <= 500),
  uploaded_by uuid references tournament_participants(id) on delete set null,
  created_at timestamptz not null default now()
);
create index match_proofs_tournament_idx on match_proofs(tournament_id);
create index match_proofs_uploaded_by_idx on match_proofs(uploaded_by);
alter table match_proofs enable row level security;
create policy proofs_select on match_proofs for select to authenticated using (is_member(tournament_id));

-- ───────── MVP votado ─────────
create table mvp_votes (
  match_id uuid not null references matches(id) on delete cascade,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  voter_participant_id uuid not null references tournament_participants(id) on delete cascade,
  candidate_participant_id uuid not null references tournament_participants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (match_id, voter_participant_id),
  check (voter_participant_id <> candidate_participant_id)
);
create index mvp_votes_tournament_idx on mvp_votes(tournament_id);
create index mvp_votes_voter_idx on mvp_votes(voter_participant_id);
create index mvp_votes_candidate_idx on mvp_votes(candidate_participant_id);
alter table mvp_votes enable row level security;
create policy mvp_votes_select on mvp_votes for select to authenticated using (is_member(tournament_id));

-- El MVP del partido es el más votado (empate: quien llegó primero a ese número de votos).
-- Sin votos se respeta el MVP que haya elegido el organizador. Las estadísticas (MVP, FIFA Points) se recalculan.
create function refresh_match_mvp() returns trigger language plpgsql security definer set search_path = public as $$
declare v_match uuid := coalesce(new.match_id, old.match_id); v_tournament uuid; v_top uuid;
begin
  select tournament_id into v_tournament from matches where id = v_match;
  select candidate_participant_id into v_top from mvp_votes where match_id = v_match
   group by candidate_participant_id order by count(*) desc, max(created_at) asc limit 1;
  if v_top is not null then
    update matches set mvp_id = v_top where id = v_match and mvp_id is distinct from v_top;
  end if;
  perform recompute_player_stats(v_tournament);
  return null;
end $$;
create trigger mvp_votes_after after insert or update or delete on mvp_votes for each row execute function refresh_match_mvp();
revoke all on function refresh_match_mvp() from public, anon, authenticated;

-- ───────── Sistema suizo ─────────
alter type tournament_format add value if not exists 'swiss';

-- Igual que antes, pero un suizo solo termina cuando se jugó la última ronda configurada
create or replace function check_tournament_finished(p_tournament uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_status tournament_status; v_format tournament_format; v_open int; v_champ uuid; v_total int; v_rounds int;
begin
  select status, format, coalesce((settings->>'swiss_rounds')::int, 3) into v_status, v_format, v_rounds from tournaments where id = p_tournament;
  if v_status <> 'in_progress' then return; end if;
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
revoke all on function check_tournament_finished(uuid) from public, anon, authenticated;

-- Agrega la siguiente ronda del suizo con los emparejamientos calculados por el motor TypeScript
create function add_swiss_round(p_tournament uuid, p_matches jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare v_round int; v_rounds int; v_format tournament_format; v_status tournament_status;
begin
  if not is_organizer(p_tournament) then raise exception 'No autorizado' using errcode = '42501'; end if;
  select format, status, coalesce((settings->>'swiss_rounds')::int, 3) into v_format, v_status, v_rounds from tournaments where id = p_tournament;
  if v_format::text <> 'swiss' or v_status <> 'in_progress' then raise exception 'El torneo no es un suizo en curso' using errcode = 'P0001'; end if;
  if exists (select 1 from matches where tournament_id = p_tournament and status not in ('finished','cancelled')) then
    raise exception 'Termina todos los partidos de la ronda actual primero' using errcode = 'P0001'; end if;
  select coalesce(max(round), 0) + 1 into v_round from matches where tournament_id = p_tournament;
  if v_round > v_rounds then raise exception 'Ya se jugaron las % rondas', v_rounds using errcode = 'P0001'; end if;
  if jsonb_array_length(p_matches) = 0 then raise exception 'La ronda no tiene partidos' using errcode = 'P0001'; end if;

  insert into matches (id, tournament_id, stage, round, position, leg, home_id, away_id)
  select (e->>'id')::uuid, p_tournament, 'league', v_round, i::int, 1, (e->>'home_id')::uuid, (e->>'away_id')::uuid
    from jsonb_array_elements(p_matches) with ordinality as x(e, i);

  perform notify(p_tournament, pp.id, 'match_pending', 'Ronda ' || v_round || ' lista', 'Ya tienes rival para la siguiente ronda')
     from tournament_participants pp where pp.tournament_id = p_tournament;
  return v_round;
end $$;
revoke all on function add_swiss_round(uuid, jsonb) from public, anon;
grant execute on function add_swiss_round(uuid, jsonb) to authenticated, service_role;

-- Tiempo real para las nuevas tablas
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table match_proofs, mvp_votes;
  end if;
end $$;

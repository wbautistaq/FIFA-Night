-- FIFA Night · noche en vivo: varias consolas, llamado de partidos ("te toca jugar") y avisos push

-- Consolas/TVs disponibles. Va fuera de settings para poder cambiarlo con el torneo en curso.
alter table tournaments add column stations smallint not null default 1 check (stations between 1 and 8);

-- Consola donde se juega el partido y cuándo se llamó a los jugadores
alter table matches add column station smallint check (station between 1 and 8);
alter table matches add column called_at timestamptz;
create index matches_station_idx on matches(tournament_id, station) where station is not null;

alter table notifications drop constraint notifications_kind_check;
alter table notifications add constraint notifications_kind_check check (kind in (
  'invitation','draw_done','match_pending','result_reported','result_confirmed','playoffs_start','new_leader','tournament_finished','your_turn'));

-- Llama un partido a una consola libre y avisa a los dos jugadores
create function call_match(p_match uuid, p_station smallint) returns void
language plpgsql security definer set search_path = public as $$
declare m matches; v_t tournaments; v_home text; v_away text;
begin
  select * into m from matches where id = p_match for update;
  if not found or not is_organizer(m.tournament_id) then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into v_t from tournaments where id = m.tournament_id;
  if v_t.status <> 'in_progress' then raise exception 'El torneo no está en curso' using errcode = 'P0001'; end if;
  if m.status <> 'pending' or m.home_id is null or m.away_id is null or m.is_bye then
    raise exception 'Ese partido no se puede llamar' using errcode = 'P0001'; end if;
  if p_station < 1 or p_station > v_t.stations then raise exception 'Consola inválida' using errcode = 'P0001'; end if;
  if exists (select 1 from matches x where x.tournament_id = m.tournament_id and x.id <> m.id and x.station = p_station
             and x.status in ('pending','live')) then
    raise exception 'La consola % está ocupada', p_station using errcode = 'P0001'; end if;
  if exists (select 1 from matches x where x.tournament_id = m.tournament_id and x.id <> m.id and x.station is not null
             and x.status in ('pending','live') and (x.home_id in (m.home_id, m.away_id) or x.away_id in (m.home_id, m.away_id))) then
    raise exception 'Uno de los jugadores ya está en otra consola' using errcode = 'P0001'; end if;

  update matches set station = p_station, called_at = now() where id = p_match;
  select coalesce(nickname, display_name) into v_home from tournament_participants where id = m.home_id;
  select coalesce(nickname, display_name) into v_away from tournament_participants where id = m.away_id;
  perform notify(m.tournament_id, m.home_id, 'your_turn', '¡Te toca jugar!', format('Consola %s · contra %s', p_station, v_away));
  perform notify(m.tournament_id, m.away_id, 'your_turn', '¡Te toca jugar!', format('Consola %s · contra %s', p_station, v_home));
end $$;
revoke all on function call_match(uuid, smallint) from public, anon;
grant execute on function call_match(uuid, smallint) to authenticated, service_role;

-- Devuelve un partido llamado (aún sin empezar) a la cola
create function uncall_match(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m matches;
begin
  select * into m from matches where id = p_match;
  if not found or not is_organizer(m.tournament_id) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if m.status <> 'pending' then raise exception 'El partido ya empezó' using errcode = 'P0001'; end if;
  update matches set station = null, called_at = null where id = p_match;
end $$;
revoke all on function uncall_match(uuid) from public, anon;
grant execute on function uncall_match(uuid) to authenticated, service_role;

-- Suscripciones Web Push (avisos con la app cerrada). Solo el servidor las lee y escribe.
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  participant_id uuid references tournament_participants(id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now(),
  check (user_id is not null or participant_id is not null)
);
create index push_subscriptions_user_idx on push_subscriptions(user_id);
create index push_subscriptions_participant_idx on push_subscriptions(participant_id);
alter table push_subscriptions enable row level security;
revoke all on push_subscriptions from anon, authenticated;

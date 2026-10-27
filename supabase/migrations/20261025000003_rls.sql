-- FIFA Night · Row Level Security
-- Roles: organizador (owner), coorganizador, jugador (con cuenta), invitado/espectador (por token, vía rutas de servidor).

create function is_service() returns boolean language sql stable as $$
  select coalesce(auth.role(), '') = 'service_role'
$$;

create function is_member(p_tournament uuid, p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select p_user is not null and (
    exists (select 1 from tournaments t where t.id = p_tournament and t.owner_id = p_user)
    or exists (select 1 from tournament_participants tp where tp.tournament_id = p_tournament and tp.user_id = p_user))
$$;

create function my_participant(p_tournament uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from tournament_participants where tournament_id = p_tournament and user_id = auth.uid() limit 1
$$;

create function shares_tournament(p_other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_other = auth.uid()
      or exists (select 1 from tournament_participants a
                   join tournament_participants b on b.tournament_id = a.tournament_id
                  where a.user_id = auth.uid() and b.user_id = p_other)
      or exists (select 1 from tournaments t where t.owner_id = auth.uid()
                   and exists (select 1 from tournament_participants b where b.tournament_id = t.id and b.user_id = p_other))
      or exists (select 1 from tournaments t where t.owner_id = p_other and is_member(t.id))
$$;

create function tournament_editable(p_tournament uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from tournaments where id = p_tournament and status in ('draft','registration','draw'))
$$;

-- Activar RLS en todas las tablas
alter table profiles enable row level security;
alter table tournaments enable row level security;
alter table tournament_participants enable row level security;
alter table invitations enable row level security;
alter table fifa_teams enable row level security;
alter table team_assignments enable row level security;
alter table matches enable row level security;
alter table match_results enable row level security;
alter table standings enable row level security;
alter table brackets enable row level security;
alter table player_stats enable row level security;
alter table achievements enable row level security;
alter table predictions enable row level security;
alter table tournament_posts enable row level security;
alter table post_reactions enable row level security;
alter table notifications enable row level security;

-- profiles
create policy profiles_select on profiles for select to authenticated using (shares_tournament(id));
create policy profiles_insert on profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- tournaments
create policy tournaments_select on tournaments for select to authenticated using (owner_id = auth.uid() or is_member(id));
create policy tournaments_insert on tournaments for insert to authenticated
  with check (owner_id = auth.uid() and status = 'draft');
create policy tournaments_update on tournaments for update to authenticated
  using (is_organizer(id)) with check (is_organizer(id));
create policy tournaments_delete on tournaments for delete to authenticated
  using (owner_id = auth.uid() and status = 'draft');

-- Un organizador no puede reconfigurar un torneo ya iniciado ni saltarse estados
create function guard_tournament_update() returns trigger language plpgsql as $$
begin
  if is_service() or current_user = 'postgres' and auth.uid() is null then return new; end if;
  if new.owner_id <> old.owner_id then raise exception 'No se puede cambiar el organizador' using errcode = '42501'; end if;
  if old.status in ('in_progress','finished','cancelled')
     and (new.name, new.format, new.max_players, new.settings, new.platform) is distinct from (old.name, old.format, old.max_players, old.settings, old.platform)
     and not (old.status = 'in_progress' and new.settings = old.settings and new.format = old.format and new.max_players = old.max_players) then
    raise exception 'La configuración ya no se puede editar con el torneo iniciado' using errcode = 'P0001';
  end if;
  if new.status is distinct from old.status and not (
       (old.status = 'draft' and new.status in ('registration','cancelled'))
    or (old.status = 'registration' and new.status in ('draft','cancelled'))
    or (old.status = 'draw' and new.status in ('registration','cancelled'))
    or (old.status = 'in_progress' and new.status = 'cancelled')) then
    -- los demás cambios solo ocurren dentro de funciones del sistema
    if current_user not in ('postgres','supabase_admin') then
      raise exception 'Transición de estado no permitida: % → %', old.status, new.status using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger tournaments_guard before update on tournaments for each row execute function guard_tournament_update();

-- participantes
create policy participants_select on tournament_participants for select to authenticated using (is_member(tournament_id));
create policy participants_insert on tournament_participants for insert to authenticated
  with check (is_organizer(tournament_id) and tournament_editable(tournament_id));
create policy participants_update on tournament_participants for update to authenticated
  using (is_organizer(tournament_id) or user_id = auth.uid())
  with check (is_organizer(tournament_id) or user_id = auth.uid());
create policy participants_delete on tournament_participants for delete to authenticated
  using (is_organizer(tournament_id) and tournament_editable(tournament_id));

-- Un jugador solo puede cambiar sus datos de presentación, no su rol ni su torneo
create function guard_participant_update() returns trigger language plpgsql as $$
begin
  if is_service() or is_organizer(old.tournament_id) then return new; end if;
  if (new.tournament_id, new.user_id, new.role, new.guest_token, new.seed, new.group_name)
     is distinct from (old.tournament_id, old.user_id, old.role, old.guest_token, old.seed, old.group_name) then
    raise exception 'Solo puedes editar tus datos de presentación' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger participants_guard before update on tournament_participants for each row execute function guard_participant_update();

-- Límite de participantes
create function guard_participant_insert() returns trigger language plpgsql security definer set search_path = public as $$
declare v_max int; v_count int; v_status tournament_status;
begin
  select max_players, status into v_max, v_status from tournaments where id = new.tournament_id;
  select count(*) into v_count from tournament_participants where tournament_id = new.tournament_id;
  if v_status not in ('draft','registration') then raise exception 'La inscripción está cerrada' using errcode = 'P0001'; end if;
  if v_count >= v_max then raise exception 'El torneo ya alcanzó el máximo de jugadores (%)', v_max using errcode = 'P0001'; end if;
  return new;
end $$;
create trigger participants_limit before insert on tournament_participants for each row execute function guard_participant_insert();

-- invitaciones (solo organización; los invitados validan token en servidor)
create policy invitations_all on invitations for all to authenticated
  using (is_organizer(tournament_id)) with check (is_organizer(tournament_id) and created_by = auth.uid());

-- equipos
create policy teams_select on fifa_teams for select to authenticated using (tournament_id is null or is_member(tournament_id));
create policy teams_insert on fifa_teams for insert to authenticated with check (tournament_id is not null and is_organizer(tournament_id));
create policy teams_update on fifa_teams for update to authenticated using (tournament_id is not null and is_organizer(tournament_id)) with check (tournament_id is not null and is_organizer(tournament_id));
create policy teams_delete on fifa_teams for delete to authenticated using (tournament_id is not null and is_organizer(tournament_id) and tournament_editable(tournament_id));

create policy assignments_select on team_assignments for select to authenticated using (is_member(tournament_id));
create policy assignments_write on team_assignments for all to authenticated
  using (is_organizer(tournament_id) and tournament_editable(tournament_id) and not (select draw_confirmed from tournaments where id = tournament_id))
  with check (is_organizer(tournament_id) and tournament_editable(tournament_id) and not (select draw_confirmed from tournaments where id = tournament_id));

-- partidos
create policy matches_select on matches for select to authenticated using (is_member(tournament_id));
create policy matches_update on matches for update to authenticated using (is_organizer(tournament_id)) with check (is_organizer(tournament_id));

-- resultados
create policy results_select on match_results for select to authenticated
  using (exists (select 1 from matches m where m.id = match_id and is_member(m.tournament_id)));
create policy results_insert on match_results for insert to authenticated with check (
  exists (select 1 from matches m where m.id = match_id and (
    is_organizer(m.tournament_id)
    or (match_results.status = 'reported' and not match_results.reported_by_organizer
        and match_results.reported_by = my_participant(m.tournament_id)
        and match_results.reported_by in (m.home_id, m.away_id)
        and coalesce((select (settings->>'player_reporting')::boolean from tournaments where id = m.tournament_id), false)))));
create policy results_update on match_results for update to authenticated
  using (exists (select 1 from matches m where m.id = match_id and (is_organizer(m.tournament_id)
           or (match_results.status = 'reported' and my_participant(m.tournament_id) in (m.home_id, m.away_id)))))
  with check (exists (select 1 from matches m where m.id = match_id and (is_organizer(m.tournament_id)
           or my_participant(m.tournament_id) in (m.home_id, m.away_id))));
create policy results_delete on match_results for delete to authenticated
  using (exists (select 1 from matches m where m.id = match_id and is_organizer(m.tournament_id)));

-- El rival solo puede confirmar o disputar lo reportado por el otro, sin alterar el marcador
create function guard_result_update() returns trigger language plpgsql security definer set search_path = public as $$
declare m matches; v_me uuid;
begin
  select * into m from matches where id = old.match_id;
  if is_service() or is_organizer(m.tournament_id) then return new; end if;
  v_me := my_participant(m.tournament_id);
  if old.status <> 'reported' or new.status not in ('confirmed','disputed')
     or v_me is null or v_me = old.reported_by or v_me not in (m.home_id, m.away_id)
     or (new.home_score, new.away_score, new.home_pens, new.away_pens, new.match_id)
        is distinct from (old.home_score, old.away_score, old.home_pens, old.away_pens, old.match_id) then
    raise exception 'Solo el rival puede confirmar o disputar el resultado reportado' using errcode = '42501';
  end if;
  new.confirmed_by := case when new.status = 'confirmed' then v_me else null end;
  return new;
end $$;
create trigger results_guard before update on match_results for each row execute function guard_result_update();

-- Un resultado solo se registra si el partido tiene ambos jugadores
create function guard_result_insert() returns trigger language plpgsql security definer set search_path = public as $$
declare m matches; v_organizer boolean;
begin
  select * into m from matches where id = new.match_id;
  if m.home_id is null or m.away_id is null then raise exception 'El partido aún no tiene ambos jugadores' using errcode = 'P0001'; end if;
  if m.status = 'cancelled' then raise exception 'El partido está cancelado' using errcode = 'P0001'; end if;
  v_organizer := is_service() or is_organizer(m.tournament_id);
  if not v_organizer and new.status <> 'reported' then
    raise exception 'Los jugadores solo pueden reportar resultados' using errcode = '42501'; end if;
  if (select status from tournaments where id = m.tournament_id) <> 'in_progress' then
    raise exception 'El torneo no está en curso' using errcode = 'P0001'; end if;
  if new.home_score = new.away_score and new.home_pens is null and is_knockout_stage(m.stage) then
    raise exception 'En eliminatorias un empate requiere penales' using errcode = 'P0001'; end if;
  if new.home_pens is not null and new.home_pens = new.away_pens then
    raise exception 'Los penales no pueden terminar empatados' using errcode = 'P0001'; end if;
  if new.home_pens is not null and new.home_score <> new.away_score then
    raise exception 'Solo hay penales si el marcador está empatado' using errcode = 'P0001'; end if;
  return new;
end $$;
create trigger results_insert_guard before insert on match_results for each row execute function guard_result_insert();

-- Tablas derivadas: solo lectura para clientes
create policy standings_select on standings for select to authenticated using (is_member(tournament_id));
create policy brackets_select on brackets for select to authenticated using (is_member(tournament_id));
create policy stats_select on player_stats for select to authenticated using (is_member(tournament_id) or (user_id = auth.uid()));
create policy achievements_select on achievements for select to authenticated using (is_member(tournament_id));

-- predicciones
create policy predictions_select on predictions for select to authenticated using (is_member(tournament_id));
create policy predictions_insert on predictions for insert to authenticated with check (
  participant_id = my_participant(tournament_id)
  and coalesce((select (settings->>'predictions')::boolean from tournaments where id = tournament_id), false)
  and exists (select 1 from matches m where m.id = match_id and m.tournament_id = predictions.tournament_id
              and m.status = 'pending' and m.home_id is not null and m.away_id is not null
              and participant_id not in (m.home_id, m.away_id)));
create policy predictions_update on predictions for update to authenticated
  using (participant_id = my_participant(tournament_id) and not settled
         and exists (select 1 from matches m where m.id = match_id and m.status = 'pending'))
  with check (participant_id = my_participant(tournament_id) and not settled);

-- muro
create policy posts_select on tournament_posts for select to authenticated using (is_member(tournament_id));
create policy posts_insert on tournament_posts for insert to authenticated
  with check (author_participant_id = my_participant(tournament_id)
              or (is_organizer(tournament_id) and exists (select 1 from tournament_participants p where p.id = author_participant_id and p.tournament_id = tournament_posts.tournament_id and p.user_id = auth.uid())));
create policy posts_delete on tournament_posts for delete to authenticated
  using (is_organizer(tournament_id) or author_participant_id = my_participant(tournament_id));
create policy reactions_select on post_reactions for select to authenticated
  using (exists (select 1 from tournament_posts p where p.id = post_id and is_member(p.tournament_id)));
create policy reactions_insert on post_reactions for insert to authenticated
  with check (exists (select 1 from tournament_posts p where p.id = post_id and participant_id = my_participant(p.tournament_id)));
create policy reactions_delete on post_reactions for delete to authenticated
  using (exists (select 1 from tournament_posts p where p.id = post_id and participant_id = my_participant(p.tournament_id)));

-- notificaciones
create policy notifications_select on notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Privilegios: RPC solo para autenticados; funciones internas no expuestas
revoke all on function process_match(uuid), recompute_standings(uuid), recompute_player_stats(uuid), award_achievements(uuid),
  settle_predictions(uuid), check_tournament_finished(uuid), fill_playoffs(uuid), resolve_byes(uuid), push_to_slot(uuid,text,uuid,boolean),
  notify(uuid,uuid,text,text,text) from public, anon, authenticated;
revoke all on function confirm_draw(uuid), start_tournament(uuid,jsonb,jsonb) from public, anon;
grant execute on function confirm_draw(uuid), start_tournament(uuid,jsonb,jsonb) to authenticated, service_role;

-- Realtime
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table matches, match_results, standings, tournament_posts, post_reactions, notifications, tournament_participants, team_assignments, player_stats, predictions;
  end if;
end $$;

-- Storage: bucket de avatares e imágenes del muro (policies en storage.objects solo si existe el esquema)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('fifa-night', 'fifa-night', true, 2097152, array['image/jpeg','image/png','image/webp'])
    on conflict (id) do nothing;
    execute $p$create policy "fifa_night_read" on storage.objects for select using (bucket_id = 'fifa-night')$p$;
    execute $p$create policy "fifa_night_insert" on storage.objects for insert to authenticated
      with check (bucket_id = 'fifa-night' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy "fifa_night_delete" on storage.objects for delete to authenticated
      using (bucket_id = 'fifa-night' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  end if;
end $$;

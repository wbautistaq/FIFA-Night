-- Torneo demo OPCIONAL (no forma parte del seed automático).
-- Uso: psql "$DATABASE_URL" -v owner_email=tu@correo.com -f supabase/demo.sql
-- Requiere que el usuario ya haya iniciado sesión al menos una vez (existe en auth.users).
select set_config('app.owner_email', :'owner_email', false);
do $$
declare v_owner uuid; v_t uuid; v_names text[] := array['Ana','Beto','Carla','Dani','Eli','Fabi'];
begin
  select id into v_owner from auth.users where email = current_setting('app.owner_email');
  if v_owner is null then raise exception 'No existe un usuario con ese correo: inicia sesión en la app primero'; end if;
  insert into tournaments (owner_id, name, format, max_players, status)
  values (v_owner, 'Torneo demo FIFA Night', 'league', 8, 'draft') returning id into v_t;
  update tournaments set status = 'registration' where id = v_t;
  insert into tournament_participants (tournament_id, display_name, avatar_color)
  select v_t, n, (array['#7c3aed','#0ea5e9','#f97316','#ef4444','#14b8a6','#eab308'])[i]
    from unnest(v_names) with ordinality as x(n, i);
  insert into invitations (tournament_id, created_by) values (v_t, v_owner);
end $$;

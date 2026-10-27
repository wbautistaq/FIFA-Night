-- FIFA Night · el organizador puede eliminar torneos cancelados (antes solo borradores)

alter policy tournaments_delete on tournaments
  using (owner_id = (select auth.uid()) and status in ('draft', 'cancelled'));

-- Borrado completo: las asignaciones apuntan con RESTRICT a los equipos propios del torneo,
-- así que se quitan antes que el torneo (el resto cae en cascada).
create function delete_tournament(p_tournament uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t tournaments;
begin
  select * into t from tournaments where id = p_tournament;
  if not found or t.owner_id is distinct from auth.uid() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if t.status not in ('draft', 'cancelled') then
    raise exception 'Solo se pueden eliminar torneos en borrador o cancelados' using errcode = 'P0001'; end if;
  delete from team_assignments where tournament_id = p_tournament;
  delete from tournaments where id = p_tournament;
end $$;
revoke all on function delete_tournament(uuid) from public, anon;
grant execute on function delete_tournament(uuid) to authenticated, service_role;

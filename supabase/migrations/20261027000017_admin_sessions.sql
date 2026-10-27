-- FIFA Night · sesiones abiertas para el panel de administración
-- Solo el servidor (clave de servicio, tras comprobar rol + 2FA) puede usar estas funciones.
-- No se expone la IP ni ningún token: solo dispositivo, nivel de verificación y horas.

create function admin_list_sessions() returns table (
  session_id uuid,
  user_id uuid,
  email text,
  created_at timestamptz,
  last_active_at timestamptz,
  aal text,
  user_agent text
)
language sql stable security definer set search_path = public, auth as $$
  select s.id, s.user_id, u.email::text, s.created_at,
         greatest(s.created_at, s.updated_at, (s.refreshed_at at time zone 'utc')) as last_active_at,
         s.aal::text, left(s.user_agent, 300)
    from auth.sessions s join auth.users u on u.id = s.user_id
   where s.not_after is null or s.not_after > now()
   order by last_active_at desc
$$;
revoke all on function admin_list_sessions() from public, anon, authenticated;
grant execute on function admin_list_sessions() to service_role;

-- Cierra una sola sesión (un dispositivo); admin_revoke_sessions cierra todas las de un usuario
create function admin_revoke_session(p_session uuid) returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare v_user uuid;
begin
  delete from auth.sessions where id = p_session returning user_id into v_user;
  return v_user;
end $$;
revoke all on function admin_revoke_session(uuid) from public, anon, authenticated;
grant execute on function admin_revoke_session(uuid) to service_role;

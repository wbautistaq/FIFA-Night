-- FIFA Night · módulo de administrador de la plataforma
-- Todo se usa desde el servidor con la clave de servicio, después de comprobar rol de administrador + 2FA.

-- Registro de auditoría: quién hizo qué y cuándo. Sin permisos para usuarios (ni leer ni escribir).
create table admin_audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid not null,
  admin_email text,
  action text not null check (char_length(action) <= 60),
  target_type text check (target_type in ('user','tournament','platform')),
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_log_created_idx on admin_audit_log(created_at desc);
alter table admin_audit_log enable row level security;
revoke all on admin_audit_log from anon, authenticated;

-- Cierra todas las sesiones de un usuario (sus refresh tokens dejan de servir; el acceso actual caduca en ≤1 h)
create function admin_revoke_sessions(p_user uuid) returns int
language plpgsql security definer set search_path = public, auth as $$
declare v int;
begin
  delete from auth.sessions where user_id = p_user;
  get diagnostics v = row_count;
  return v;
end $$;
revoke all on function admin_revoke_sessions(uuid) from public, anon, authenticated;
grant execute on function admin_revoke_sessions(uuid) to service_role;

-- Mantenimiento: recalcula tabla, predicciones y estadísticas de un torneo
create function admin_recompute_tournament(p_tournament uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform recompute_standings(p_tournament);
  perform settle_predictions(p_tournament);
  perform recompute_player_stats(p_tournament);
end $$;
revoke all on function admin_recompute_tournament(uuid) from public, anon, authenticated;
grant execute on function admin_recompute_tournament(uuid) to service_role;

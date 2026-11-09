-- FIFA Night · apariencia del sitio y plan premium
-- Una sola fila (id = 1). Todos pueden leerla (también invitados sin cuenta);
-- solo el servidor la cambia con la clave de servicio, después de validar administrador + 2FA.

create table if not exists site_settings (
  id smallint primary key default 1 check (id = 1),
  premium boolean not null default false,
  theme text not null default 'pizarra'
    check (theme in ('pizarra','estadio','matchday','bento','brutal','aurora','tv','pixel','neon')),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

insert into site_settings (id) values (1) on conflict (id) do nothing;

alter table site_settings enable row level security;
revoke all on site_settings from anon, authenticated;
grant select on site_settings to anon, authenticated;

drop policy if exists site_settings_read on site_settings;
create policy site_settings_read on site_settings for select to anon, authenticated using (true);

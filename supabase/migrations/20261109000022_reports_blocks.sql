-- FIFA Night · reportes de contenido y bloqueos entre usuarios
-- (requisitos de Google Play para apps con contenido creado por los usuarios)

-- Reportes: los crea cualquier participante (también invitados) y los atiende el equipo de la plataforma.
-- Solo el servidor los lee y escribe con la clave de servicio: no hay políticas para anon/authenticated.
create table if not exists content_reports (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('post','user')),
  reason text not null check (reason in ('spam','ofensivo','acoso','inapropiado','suplantacion','otro')),
  details text check (char_length(details) <= 500),
  tournament_id uuid references tournaments(id) on delete set null,
  tournament_name text,
  post_id uuid references tournament_posts(id) on delete set null,
  -- Copia del contenido reportado: el equipo lo ve aunque el autor lo borre después
  post_body text,
  post_image_url text,
  reported_participant_id uuid references tournament_participants(id) on delete set null,
  reported_user_id uuid references profiles(id) on delete set null,
  reported_name text,
  reporter_user_id uuid references profiles(id) on delete set null,
  reporter_participant_id uuid references tournament_participants(id) on delete set null,
  reporter_name text,
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  resolution text,
  resolved_by uuid,
  resolved_at timestamptz
);
create index if not exists content_reports_status_idx on content_reports(status, created_at desc);
create index if not exists content_reports_reporter_idx on content_reports(reporter_participant_id, created_at desc);
alter table content_reports enable row level security;
revoke all on content_reports from anon, authenticated;

-- Bloqueos: cada persona con cuenta oculta las publicaciones de quien bloquea. Solo ve y cambia los suyos.
create table if not exists user_blocks (
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table user_blocks enable row level security;
revoke all on user_blocks from anon, authenticated;
grant select, insert, delete on user_blocks to authenticated;

drop policy if exists user_blocks_select on user_blocks;
drop policy if exists user_blocks_insert on user_blocks;
drop policy if exists user_blocks_delete on user_blocks;
create policy user_blocks_select on user_blocks for select to authenticated using (blocker_id = (select auth.uid()));
create policy user_blocks_insert on user_blocks for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy user_blocks_delete on user_blocks for delete to authenticated using (blocker_id = (select auth.uid()));

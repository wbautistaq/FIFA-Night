-- FIFA Night · esquema base
create extension if not exists pgcrypto;

-- ───────── Tipos ─────────
create type platform_kind as enum ('presencial','playstation','xbox','pc');
create type tournament_format as enum ('league','league_double','cup','double_elimination','groups_playoffs','friendlies');
create type tournament_status as enum ('draft','registration','draw','in_progress','finished','cancelled');
create type match_stage as enum ('league','group','knockout','winners','losers','grand_final','third_place','friendly');
create type match_status as enum ('pending','live','finished','disputed','cancelled');
create type result_status as enum ('reported','confirmed','disputed');
create type participant_role as enum ('player','coorganizer');
create type team_kind as enum ('club','national');

-- ───────── profiles ─────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  nickname text check (nickname is null or char_length(nickname) <= 30),
  avatar_url text,
  platform platform_kind not null default 'presencial',
  gamer_id text check (gamer_id is null or char_length(gamer_id) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────── tournaments ─────────
create table tournaments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete restrict,
  name text not null check (char_length(name) between 3 and 80),
  starts_at timestamptz not null default now(),
  platform platform_kind not null default 'presencial',
  format tournament_format not null default 'league',
  max_players int not null default 8 check (max_players between 4 and 32),
  rules text not null default '' check (char_length(rules) <= 2000),
  status tournament_status not null default 'draft',
  -- Ajustes: penales, tercer puesto, clasificados por grupo, FIFA Points, predicciones, desempates, reporte por jugadores
  settings jsonb not null default '{
    "penalties": true,
    "third_place": false,
    "group_size": 4,
    "qualifiers_per_group": 2,
    "tiebreakers": ["points","goal_difference","goals_for","head_to_head","alphabetical"],
    "player_reporting": false,
    "fifa_points": true,
    "predictions": true,
    "exact_score_predictions": true,
    "wall": true
  }'::jsonb,
  duplicated_from uuid references tournaments(id) on delete set null,
  draw_confirmed boolean not null default false,
  champion_participant_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tournaments_owner_idx on tournaments(owner_id, created_at desc);
create index tournaments_status_idx on tournaments(status);

create table tournament_participants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 40),
  nickname text check (nickname is null or char_length(nickname) <= 30),
  avatar_url text,
  avatar_color text not null default '#7c3aed',
  platform platform_kind not null default 'presencial',
  gamer_id text check (gamer_id is null or char_length(gamer_id) <= 40),
  guest_token text unique default encode(gen_random_bytes(24),'hex'),
  role participant_role not null default 'player',
  seed int,
  group_name text,
  joined_at timestamptz not null default now()
);
create unique index participants_name_uniq on tournament_participants(tournament_id, lower(display_name));
create unique index participants_user_uniq on tournament_participants(tournament_id, user_id) where user_id is not null;
create index participants_tournament_idx on tournament_participants(tournament_id);
alter table tournaments add constraint tournaments_champion_fk
  foreign key (champion_participant_id) references tournament_participants(id) on delete set null;

create table invitations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(18),'hex'),
  created_by uuid not null references profiles(id) on delete cascade,
  expires_at timestamptz,
  revoked_at timestamptz,
  uses int not null default 0,
  created_at timestamptz not null default now()
);
create index invitations_tournament_idx on invitations(tournament_id);

-- ───────── equipos ─────────
create table fifa_teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade, -- null = banco global
  name text not null check (char_length(name) between 2 and 60),
  short_name text not null check (char_length(short_name) between 2 and 4),
  league text not null,
  country text not null,
  rating int not null check (rating between 40 and 99),
  kind team_kind not null default 'club',
  color_primary text not null default '#16a34a',
  color_secondary text not null default '#ffffff',
  banned boolean not null default false,
  favorite boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index fifa_teams_global_uniq on fifa_teams(lower(name)) where tournament_id is null;
create unique index fifa_teams_tournament_uniq on fifa_teams(tournament_id, lower(name)) where tournament_id is not null;
create index fifa_teams_tournament_idx on fifa_teams(tournament_id);

create table team_assignments (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  participant_id uuid not null references tournament_participants(id) on delete cascade,
  team_id uuid not null references fifa_teams(id) on delete restrict,
  confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tournament_id, participant_id)
);
create index team_assignments_tournament_idx on team_assignments(tournament_id);

-- ───────── partidos ─────────
create table matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  stage match_stage not null,
  group_name text,
  round int not null default 1,
  position int not null default 1,
  leg int not null default 1,
  home_id uuid references tournament_participants(id) on delete set null,
  away_id uuid references tournament_participants(id) on delete set null,
  next_match_id uuid references matches(id) on delete set null,
  next_slot text check (next_slot in ('home','away')),
  loser_next_match_id uuid references matches(id) on delete set null,
  loser_next_slot text check (loser_next_slot in ('home','away')),
  status match_status not null default 'pending',
  scheduled_at timestamptz,
  winner_id uuid references tournament_participants(id) on delete set null,
  is_bye boolean not null default false,
  mvp_id uuid references tournament_participants(id) on delete set null,
  created_at timestamptz not null default now(),
  check (home_id is null or away_id is null or home_id <> away_id)
);
create index matches_tournament_idx on matches(tournament_id, stage, round, position);
create index matches_home_idx on matches(home_id);
create index matches_away_idx on matches(away_id);

create table match_results (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  home_score int not null check (home_score between 0 and 99),
  away_score int not null check (away_score between 0 and 99),
  home_pens int check (home_pens between 0 and 99),
  away_pens int check (away_pens between 0 and 99),
  status result_status not null default 'reported',
  reported_by uuid references tournament_participants(id) on delete set null,
  reported_by_organizer boolean not null default false,
  confirmed_by uuid references tournament_participants(id) on delete set null,
  played_at timestamptz not null default now(),
  fair_play_home int not null default 0 check (fair_play_home >= 0),
  fair_play_away int not null default 0 check (fair_play_away >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((home_pens is null) = (away_pens is null))
);
-- Constraint contra resultados duplicados confirmados/activos: un solo resultado por partido
create unique index match_results_one_per_match on match_results(match_id);

-- ───────── tabla, bracket, estadísticas ─────────
create table standings (
  tournament_id uuid not null references tournaments(id) on delete cascade,
  participant_id uuid not null references tournament_participants(id) on delete cascade,
  group_name text not null default '',
  played int not null default 0,
  won int not null default 0,
  drawn int not null default 0,
  lost int not null default 0,
  goals_for int not null default 0,
  goals_against int not null default 0,
  goal_difference int not null default 0,
  points int not null default 0,
  position int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (tournament_id, participant_id)
);
create index standings_rank_idx on standings(tournament_id, group_name, position);

create table brackets (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  kind text not null check (kind in ('knockout','winners','losers','playoffs')),
  rounds int not null,
  has_third_place boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tournament_id, kind)
);

create table player_stats (
  tournament_id uuid not null references tournaments(id) on delete cascade,
  participant_id uuid not null references tournament_participants(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  played int not null default 0,
  won int not null default 0,
  drawn int not null default 0,
  lost int not null default 0,
  goals_for int not null default 0,
  goals_against int not null default 0,
  clean_sheets int not null default 0,
  biggest_win int not null default 0,
  biggest_loss int not null default 0,
  current_streak int not null default 0, -- >0 victorias seguidas, <0 derrotas seguidas
  best_streak int not null default 0,
  mvp_count int not null default 0,
  fair_play_points int not null default 0,
  fifa_points int not null default 0,
  champion boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (tournament_id, participant_id)
);
create index player_stats_user_idx on player_stats(user_id);

create table achievements (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  participant_id uuid not null references tournament_participants(id) on delete cascade,
  code text not null check (code in ('first_title','top_scorer','unbeaten','clasico_king','worst_defense','penalty_specialist','comeback_kid','fair_play')),
  awarded_at timestamptz not null default now(),
  unique (tournament_id, participant_id, code)
);

create table predictions (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  participant_id uuid not null references tournament_participants(id) on delete cascade,
  predicted_winner_id uuid references tournament_participants(id) on delete cascade, -- null = empate
  home_score int check (home_score between 0 and 99),
  away_score int check (away_score between 0 and 99),
  points int not null default 0,
  settled boolean not null default false,
  created_at timestamptz not null default now(),
  unique (match_id, participant_id)
);
create index predictions_tournament_idx on predictions(tournament_id);

-- ───────── muro y notificaciones ─────────
create table tournament_posts (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  author_participant_id uuid not null references tournament_participants(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  image_url text,
  created_at timestamptz not null default now()
);
create index tournament_posts_idx on tournament_posts(tournament_id, created_at desc);

create table post_reactions (
  post_id uuid not null references tournament_posts(id) on delete cascade,
  participant_id uuid not null references tournament_participants(id) on delete cascade,
  reaction text not null check (reaction in ('fire','laugh','celebrate','cry','surprise')),
  created_at timestamptz not null default now(),
  primary key (post_id, participant_id, reaction)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  participant_id uuid references tournament_participants(id) on delete cascade,
  kind text not null check (kind in ('invitation','draw_done','match_pending','result_reported','result_confirmed','playoffs_start','new_leader','tournament_finished')),
  title text not null,
  body text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (user_id is not null or participant_id is not null)
);
create index notifications_user_idx on notifications(user_id, created_at desc);
create index notifications_participant_idx on notifications(participant_id, created_at desc);

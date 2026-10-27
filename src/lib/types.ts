import type { MatchStage, TournamentFormat, TournamentSettings } from "./engine/types";

export type Platform = "presencial" | "playstation" | "xbox" | "pc";
export type TournamentStatus = "draft" | "registration" | "draw" | "in_progress" | "finished" | "cancelled";
export type MatchStatus = "pending" | "live" | "finished" | "disputed" | "cancelled";
export type ResultStatus = "reported" | "confirmed" | "disputed";

export interface Profile {
  id: string;
  display_name: string;
  nickname: string | null;
  avatar_url: string | null;
  platform: Platform;
  gamer_id: string | null;
}

export interface Tournament {
  id: string;
  owner_id: string;
  name: string;
  starts_at: string;
  platform: Platform;
  format: TournamentFormat;
  max_players: number;
  rules: string;
  status: TournamentStatus;
  settings: TournamentSettings;
  draw_confirmed: boolean;
  champion_participant_id: string | null;
  tv_state: { view: "auto" | "next" | "standings" | "bracket" | "scorers" | "results" };
  /** Consolas/TVs para la noche en vivo (1–8). */
  stations: number;
  created_at: string;
}

export interface Participant {
  id: string;
  tournament_id: string;
  user_id: string | null;
  display_name: string;
  nickname: string | null;
  avatar_url: string | null;
  avatar_color: string;
  platform: Platform;
  gamer_id: string | null;
  role: "player" | "coorganizer";
  group_name: string | null;
}

export interface Team {
  id: string;
  tournament_id: string | null;
  name: string;
  short_name: string;
  league: string;
  country: string;
  rating: number;
  /** Estrellas de FC 26 (0.5–5). Null en equipos propios antiguos: se derivan del rating. */
  stars: number | null;
  kind: "club" | "national";
  color_primary: string;
  color_secondary: string;
  banned: boolean;
  favorite: boolean;
}

export interface Assignment {
  id: string;
  participant_id: string;
  team_id: string;
  confirmed: boolean;
}

export interface Match {
  id: string;
  tournament_id: string;
  stage: MatchStage;
  group_name: string | null;
  round: number;
  position: number;
  leg: number;
  home_id: string | null;
  away_id: string | null;
  next_match_id: string | null;
  status: MatchStatus;
  scheduled_at: string | null;
  winner_id: string | null;
  is_bye: boolean;
  mvp_id: string | null;
  /** Consola donde se llamó a jugar el partido. */
  station: number | null;
  called_at: string | null;
}

export interface MatchResult {
  id: string;
  match_id: string;
  home_score: number;
  away_score: number;
  home_pens: number | null;
  away_pens: number | null;
  status: ResultStatus;
  reported_by: string | null;
  reported_by_organizer: boolean;
  played_at: string;
  fair_play_home: number;
  fair_play_away: number;
  comeback_by: string | null;
}

export interface StandingRow {
  participant_id: string;
  group_name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  position: number;
}

export interface PlayerStat {
  participant_id: string;
  user_id: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  clean_sheets: number;
  biggest_win: number;
  biggest_loss: number;
  current_streak: number;
  best_streak: number;
  mvp_count: number;
  fair_play_points: number;
  fifa_points: number;
  champion: boolean;
}

export interface Achievement {
  id: string;
  participant_id: string;
  code: string;
}

export interface Prediction {
  id: string;
  match_id: string;
  participant_id: string;
  predicted_winner_id: string | null;
  home_score: number | null;
  away_score: number | null;
  points: number;
  settled: boolean;
}

export interface Post {
  id: string;
  author_participant_id: string;
  body: string;
  image_url: string | null;
  created_at: string;
}

export interface Reaction {
  post_id: string;
  participant_id: string;
  reaction: "fire" | "laugh" | "celebrate" | "cry" | "surprise";
}

export interface Bracket {
  kind: string;
  rounds: number;
  has_third_place: boolean;
}

export interface AppNotification {
  id: string;
  tournament_id: string;
  kind: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface Snapshot {
  tournament: Tournament;
  participants: Participant[];
  teams: Team[];
  assignments: Assignment[];
  matches: Match[];
  results: MatchResult[];
  standings: StandingRow[];
  stats: PlayerStat[];
  achievements: Achievement[];
  predictions: Prediction[];
  posts: Post[];
  reactions: Reaction[];
  brackets: Bracket[];
  proofs: MatchProof[];
  mvpVotes: MvpVote[];
}

export interface MatchProof {
  match_id: string;
  url: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface MvpVote {
  match_id: string;
  voter_participant_id: string;
  candidate_participant_id: string;
}

export interface Viewer {
  kind: "user" | "guest";
  userId: string | null;
  participantId: string | null;
  isOrganizer: boolean;
  guestToken?: string;
}

export type TournamentFormat =
  | "league"
  | "league_double"
  | "cup"
  | "double_elimination"
  | "groups_playoffs"
  | "friendlies"
  | "swiss";

export type MatchStage =
  | "league"
  | "group"
  | "knockout"
  | "winners"
  | "losers"
  | "grand_final"
  | "third_place"
  | "friendly";

export interface Tiebreaker {
  id: "points" | "goal_difference" | "goals_for" | "head_to_head" | "alphabetical";
}

export interface TournamentSettings {
  penalties: boolean;
  third_place: boolean;
  group_size: number;
  qualifiers_per_group: number;
  tiebreakers: Tiebreaker["id"][];
  player_reporting: boolean;
  fifa_points: boolean;
  predictions: boolean;
  exact_score_predictions: boolean;
  wall: boolean;
  /** Rondas del sistema suizo (por defecto 3). */
  swiss_rounds?: number;
}

export const DEFAULT_SETTINGS: TournamentSettings = {
  penalties: true,
  third_place: false,
  group_size: 4,
  qualifiers_per_group: 2,
  tiebreakers: ["points", "goal_difference", "goals_for", "head_to_head", "alphabetical"],
  player_reporting: false,
  fifa_points: true,
  predictions: true,
  exact_score_predictions: true,
  wall: true,
};

export interface ParticipantRef {
  id: string;
  display_name: string;
  group_name?: string | null;
}

/** Fila lista para `start_tournament` (jsonb). */
export interface MatchDraft {
  id: string;
  stage: MatchStage;
  group_name?: string;
  round: number;
  position: number;
  leg: number;
  home_id?: string;
  away_id?: string;
  next_match_id?: string;
  next_slot?: "home" | "away";
  loser_next_match_id?: string;
  loser_next_slot?: "home" | "away";
  home_seed?: number;
  away_seed?: number;
  home_empty?: boolean;
  away_empty?: boolean;
}

export interface BracketDraft {
  kind: "knockout" | "winners" | "losers" | "playoffs";
  rounds: number;
  has_third_place: boolean;
}

export interface FixturePlan {
  matches: MatchDraft[];
  brackets: BracketDraft[];
  /** Asignación de grupo por participante (solo grupos + playoffs). */
  groups: Record<string, string>;
}

export interface ResultLike {
  home_score: number;
  away_score: number;
  home_pens?: number | null;
  away_pens?: number | null;
}

export type Rng = () => number;

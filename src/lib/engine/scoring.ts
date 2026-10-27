import { winnerOf, type PlayedMatch } from "./standings";

/** Puntos de predicción — igual que `settle_predictions` en SQL. */
export const PREDICTION_POINTS = { winner: 3, exactScore: 2 } as const;

export interface PredictionInput {
  predictedWinnerId: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
}

export function scorePrediction(
  prediction: PredictionInput,
  match: PlayedMatch,
  exactScoreEnabled: boolean,
): number {
  let pts = 0;
  if (prediction.predictedWinnerId === winnerOf(match)) pts += PREDICTION_POINTS.winner;
  if (
    exactScoreEnabled &&
    prediction.homeScore === match.result.home_score &&
    prediction.awayScore === match.result.away_score
  ) {
    pts += PREDICTION_POINTS.exactScore;
  }
  return pts;
}

/** Puntos FIFA por partido — igual que `recompute_player_stats` en SQL. */
export const FIFA_POINTS = {
  win: 3,
  draw: 1,
  goal: 1,
  cleanSheet: 2,
  comeback: 2,
  underdogWin: 2,
  penaltyWin: 1,
  penaltyLoss: 1,
  mvp: 3,
  title: 10,
} as const;

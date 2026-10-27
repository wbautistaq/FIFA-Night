import { z } from "zod";
import { isValidEmojiAvatar } from "./avatars";

export const platformSchema = z.enum(["presencial", "playstation", "xbox", "pc"]);
export const formatSchema = z.enum(["league", "league_double", "cup", "double_elimination", "groups_playoffs", "friendlies", "swiss"]);

export const settingsSchema = z.object({
  penalties: z.boolean(),
  third_place: z.boolean(),
  group_size: z.number().int().min(3).max(8),
  qualifiers_per_group: z.number().int().min(1).max(4),
  tiebreakers: z.array(z.enum(["points", "goal_difference", "goals_for", "head_to_head", "alphabetical"])).min(1),
  player_reporting: z.boolean(),
  fifa_points: z.boolean(),
  predictions: z.boolean(),
  exact_score_predictions: z.boolean(),
  wall: z.boolean(),
  swiss_rounds: z.number().int().min(2).max(10).optional(),
});

export const tournamentInputSchema = z.object({
  name: z.string().trim().min(3, "El nombre debe tener al menos 3 caracteres").max(80),
  starts_at: z.string().min(1, "Elige una fecha"),
  platform: platformSchema,
  format: formatSchema,
  max_players: z.number().int().min(4, "Mínimo 4 jugadores").max(32, "Máximo 32 jugadores"),
  rules: z.string().max(2000).default(""),
  settings: settingsSchema,
});
export type TournamentInput = z.infer<typeof tournamentInputSchema>;

export const participantInputSchema = z.object({
  display_name: z.string().trim().min(1, "Escribe un nombre").max(40),
  nickname: z.string().trim().max(30).optional().or(z.literal("")),
  platform: platformSchema.default("presencial"),
  gamer_id: z.string().trim().max(40).optional().or(z.literal("")),
  avatar: z.string().refine(isValidEmojiAvatar, "Avatar inválido").optional().or(z.literal("")),
});
export type ParticipantInput = z.infer<typeof participantInputSchema>;

export const profileInputSchema = z.object({
  display_name: z.string().trim().min(1, "Escribe tu nombre").max(40),
  nickname: z.string().trim().max(30).optional().or(z.literal("")),
  platform: platformSchema,
  gamer_id: z.string().trim().max(40).optional().or(z.literal("")),
});

export const resultInputSchema = z
  .object({
    match_id: z.string().uuid(),
    home_score: z.number().int().min(0).max(99),
    away_score: z.number().int().min(0).max(99),
    home_pens: z.number().int().min(0).max(99).nullable(),
    away_pens: z.number().int().min(0).max(99).nullable(),
    mvp_id: z.string().uuid().nullable().optional(),
    comeback_by: z.string().uuid().nullable().optional(),
  })
  .refine((v) => (v.home_pens === null) === (v.away_pens === null), { message: "Completa los penales de ambos" })
  .refine((v) => v.home_pens === null || v.home_score === v.away_score, { message: "Solo hay penales si hay empate" })
  .refine((v) => v.home_pens === null || v.home_pens !== v.away_pens, { message: "Los penales no pueden empatar" });

export const postInputSchema = z.object({ body: z.string().trim().min(1, "Escribe algo").max(500) });
export const reactionSchema = z.enum(["fire", "laugh", "celebrate", "cry", "surprise"]);
export const REACTION_EMOJI: Record<z.infer<typeof reactionSchema>, string> = {
  fire: "🔥",
  laugh: "😂",
  celebrate: "🎉",
  cry: "😢",
  surprise: "😮",
};

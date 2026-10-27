import type { TournamentFormat, MatchStage } from "./engine/types";
import type { Platform, TournamentStatus } from "./types";

export const FORMAT_LABEL: Record<TournamentFormat, string> = {
  league: "Liga todos contra todos",
  league_double: "Liga ida y vuelta",
  cup: "Copa (eliminación directa)",
  double_elimination: "Doble eliminación",
  groups_playoffs: "Grupos + playoffs",
  friendlies: "Amistosos sueltos",
  swiss: "Sistema suizo",
};
export const STATUS_LABEL: Record<TournamentStatus, string> = {
  draft: "Borrador",
  registration: "Inscripción",
  draw: "Sorteo",
  in_progress: "En curso",
  finished: "Finalizado",
  cancelled: "Cancelado",
};
export const PLATFORM_LABEL: Record<Platform, string> = { presencial: "Presencial", playstation: "PlayStation", xbox: "Xbox", pc: "PC" };
export const MATCH_STATUS_LABEL = { pending: "Pendiente", live: "En juego", finished: "Finalizado", disputed: "Disputado", cancelled: "Cancelado" } as const;

export function stageLabel(stage: MatchStage, round: number, totalRounds?: number, group?: string | null): string {
  switch (stage) {
    case "league": return `Jornada ${round}`;
    case "group": return `Grupo ${group ?? ""} · Jornada ${round}`;
    case "friendly": return "Amistoso";
    case "third_place": return "Tercer puesto";
    case "grand_final": return "Gran final";
    case "winners": return `Llaves ganadores · R${round}`;
    case "losers": return `Llaves perdedores · R${round}`;
    default:
      if (totalRounds && round === totalRounds) return "Final";
      if (totalRounds && round === totalRounds - 1) return "Semifinal";
      if (totalRounds && round === totalRounds - 2) return "Cuartos de final";
      return `Ronda ${round}`;
  }
}

export const ACHIEVEMENTS: Record<string, { icon: string; title: string; description: string }> = {
  first_title: { icon: "🏆", title: "Primer título", description: "Ganó su primer torneo" },
  top_scorer: { icon: "⚽", title: "Goleador", description: "Más goles del torneo" },
  unbeaten: { icon: "🛡️", title: "Imbatido", description: "Terminó sin perder" },
  clasico_king: { icon: "👑", title: "Rey del clásico", description: "La mayor goleada del torneo" },
  worst_defense: { icon: "🥅", title: "Peor defensa", description: "Más goles recibidos" },
  penalty_specialist: { icon: "🎯", title: "Especialista en penales", description: "Más tandas ganadas" },
  comeback_kid: { icon: "🔄", title: "Comeback kid", description: "Más remontadas" },
  fair_play: { icon: "🤝", title: "Fair play", description: "Menos tarjetas del torneo" },
};

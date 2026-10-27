/**
 * Sistema suizo: en cada ronda se enfrentan jugadores con puntuación parecida y nadie repite rival.
 * Con número impar, descansa el peor clasificado que todavía no haya descansado.
 */

export interface SwissPlayer {
  id: string;
  points: number;
  goalDifference: number;
  goalsFor: number;
}

export interface SwissRound {
  pairs: [string, string][];
  bye: string | null;
}

/** Rondas recomendadas: ⌈log₂ n⌉ (mínimo 3), sin superar n − 1. */
export function recommendedSwissRounds(players: number): number {
  return Math.max(2, Math.min(players - 1, Math.max(3, Math.ceil(Math.log2(Math.max(players, 2))))));
}

const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Empareja una ronda. `ranked` va ordenado del mejor al peor; `played` son los cruces ya jugados
 * y `hadBye` quienes ya descansaron. Busca con retroceso un emparejamiento sin repeticiones;
 * si no existe (pocos jugadores y muchas rondas), permite la repetición menos reciente posible.
 */
export function swissPairings(ranked: readonly SwissPlayer[], played: ReadonlySet<string>, hadBye: ReadonlySet<string>): SwissRound {
  const order = [...ranked];
  let bye: string | null = null;
  if (order.length % 2 === 1) {
    // Descansa el peor clasificado sin descanso previo (o el último si todos descansaron ya)
    const idx = [...order].reverse().findIndex((p) => !hadBye.has(p.id));
    const pick = idx === -1 ? order.length - 1 : order.length - 1 - idx;
    bye = (order.splice(pick, 1)[0] as SwissPlayer).id;
  }

  const solve = (pool: SwissPlayer[], allowRematch: boolean): [string, string][] | null => {
    if (pool.length === 0) return [];
    const [first, ...rest] = pool as [SwissPlayer, ...SwissPlayer[]];
    for (let i = 0; i < rest.length; i++) {
      const rival = rest[i] as SwissPlayer;
      if (!allowRematch && played.has(key(first.id, rival.id))) continue;
      const tail = solve([...rest.slice(0, i), ...rest.slice(i + 1)], allowRematch);
      if (tail) return [[first.id, rival.id], ...tail];
    }
    return null;
  };

  const pairs = solve(order, false) ?? solve(order, true) ?? [];
  return { pairs, bye };
}

/** Clasificación suiza: puntos, diferencia de gol, goles a favor (orden estable con el desempate final dado). */
export function rankSwiss(players: readonly SwissPlayer[]): SwissPlayer[] {
  return [...players].sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor);
}

export const pairKey = key;

import type {
  BracketDraft,
  FixturePlan,
  MatchDraft,
  ParticipantRef,
  TournamentFormat,
  TournamentSettings,
} from "./types";

const BYE = Symbol("bye");
type Slot = string | typeof BYE;

export interface RoundPairs {
  round: number;
  pairs: Array<[string, string]>;
  /** Participante que descansa en la jornada (número impar). */
  resting?: string;
}

/** Todos contra todos por método del círculo; maneja impares con descanso. */
export function roundRobin(ids: readonly string[], double = false): RoundPairs[] {
  if (ids.length < 2) return [];
  const slots: Slot[] = [...ids];
  if (slots.length % 2 === 1) slots.push(BYE);
  const n = slots.length;
  const rounds: RoundPairs[] = [];
  let rotation = [...slots];

  for (let r = 0; r < n - 1; r++) {
    const pairs: Array<[string, string]> = [];
    let resting: string | undefined;
    for (let i = 0; i < n / 2; i++) {
      const a = rotation[i] as Slot;
      const b = rotation[n - 1 - i] as Slot;
      if (a === BYE && typeof b === "string") resting = b;
      else if (b === BYE && typeof a === "string") resting = a;
      else if (typeof a === "string" && typeof b === "string") {
        // alterna localía para equilibrar
        pairs.push(r % 2 === 0 === (i % 2 === 0) ? [a, b] : [b, a]);
      }
    }
    rounds.push({ round: r + 1, pairs, resting });
    const [first, ...rest] = rotation;
    const last = rest.pop() as Slot;
    rotation = [first as Slot, last, ...rest];
  }

  if (!double) return rounds;
  const second = rounds.map<RoundPairs>((rd) => ({
    round: rd.round + rounds.length,
    pairs: rd.pairs.map(([h, a]) => [a, h]),
    resting: rd.resting,
  }));
  return [...rounds, ...second];
}

export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Orden estándar de siembra: 1 vs S, 2 vs S-1… distribuidos para que los favoritos se crucen tarde. */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

type Draft = MatchDraft;
const uid = () => crypto.randomUUID();

function link(from: Draft, to: Draft, slot: "home" | "away") {
  from.next_match_id = to.id;
  from.next_slot = slot;
}
function linkLoser(from: Draft, to: Draft, slot: "home" | "away") {
  from.loser_next_match_id = to.id;
  from.loser_next_slot = slot;
}

interface KnockoutBuild {
  matches: Draft[];
  rounds: Draft[][];
  thirdPlace?: Draft;
}

/**
 * Construye un cuadro de eliminación directa. `seedsToIds` mapea seed→participante;
 * si es null (playoffs) se rellenan home_seed/away_seed y los clasificados entran por SQL.
 */
function buildKnockout(
  size: number,
  seedIds: Array<string | undefined>,
  qualifiers: number,
  stage: "knockout" | "winners",
  thirdPlace: boolean,
  fillBySeed: boolean,
): KnockoutBuild {
  const roundsCount = Math.log2(size);
  const rounds: Draft[][] = [];
  for (let r = 1; r <= roundsCount; r++) {
    const count = size / 2 ** r;
    rounds.push(
      Array.from({ length: count }, (_, i) => ({
        id: uid(),
        stage,
        round: r,
        position: i + 1,
        leg: 1,
      })),
    );
  }

  const order = seedOrder(size);
  (rounds[0] as Draft[]).forEach((m, i) => {
    const sh = order[i * 2] as number;
    const sa = order[i * 2 + 1] as number;
    if (fillBySeed) {
      m.home_seed = sh;
      m.away_seed = sa;
    } else {
      m.home_id = seedIds[sh - 1];
      m.away_id = seedIds[sa - 1];
    }
    if (sh > qualifiers) m.home_empty = true;
    if (sa > qualifiers) m.away_empty = true;
  });

  for (let r = 0; r < rounds.length - 1; r++) {
    (rounds[r] as Draft[]).forEach((m, i) => {
      link(m, (rounds[r + 1] as Draft[])[Math.floor(i / 2)] as Draft, i % 2 === 0 ? "home" : "away");
    });
  }

  let third: Draft | undefined;
  if (thirdPlace && roundsCount >= 2) {
    third = { id: uid(), stage: "third_place", round: roundsCount, position: 2, leg: 1 };
    const semis = rounds[roundsCount - 2] as Draft[];
    linkLoser(semis[0] as Draft, third, "home");
    linkLoser(semis[1] as Draft, third, "away");
  }

  return { matches: [...rounds.flat(), ...(third ? [third] : [])], rounds, thirdPlace: third };
}

function buildDoubleElimination(ids: string[]): { matches: Draft[]; brackets: BracketDraft[] } {
  const n = ids.length;
  const size = Math.max(4, nextPow2(n));
  const k = Math.log2(size);
  const wb = buildKnockout(size, ids, n, "winners", false, false);

  // Losers bracket: 2(k-1) rondas
  const lb: Draft[][] = [];
  for (let j = 1; j <= 2 * (k - 1); j++) {
    const count = size / 2 ** (Math.floor((j + 1) / 2) + 1);
    lb.push(
      Array.from({ length: count }, (_, i) => ({
        id: uid(),
        stage: "losers" as const,
        round: j,
        position: i + 1,
        leg: 1,
      })),
    );
  }

  // Perdedores de WB R1 → LB1 (de a dos); perdedores de WB r≥2 → LB 2(r-1) lado visitante
  (wb.rounds[0] as Draft[]).forEach((m, i) => {
    linkLoser(m, (lb[0] as Draft[])[Math.floor(i / 2)] as Draft, i % 2 === 0 ? "home" : "away");
  });
  for (let r = 2; r <= k; r++) {
    const target = lb[2 * (r - 1) - 1] as Draft[];
    (wb.rounds[r - 1] as Draft[]).forEach((m, i) => linkLoser(m, target[i] as Draft, "away"));
  }
  // Avance dentro del LB
  for (let j = 1; j < lb.length; j++) {
    (lb[j - 1] as Draft[]).forEach((m, i) => {
      if (j % 2 === 1) link(m, (lb[j] as Draft[])[i] as Draft, "home");
      else link(m, (lb[j] as Draft[])[Math.floor(i / 2)] as Draft, i % 2 === 0 ? "home" : "away");
    });
  }

  const gf: Draft = { id: uid(), stage: "grand_final", round: 1, position: 1, leg: 1 };
  link((wb.rounds[k - 1] as Draft[])[0] as Draft, gf, "home");
  link((lb[lb.length - 1] as Draft[])[0] as Draft, gf, "away");

  return {
    matches: [...wb.matches, ...lb.flat(), gf],
    brackets: [
      { kind: "winners", rounds: k, has_third_place: false },
      { kind: "losers", rounds: lb.length, has_third_place: false },
    ],
  };
}

function snakeGroups(ids: string[], groupSize: number): string[][] {
  const count = Math.max(2, Math.ceil(ids.length / groupSize));
  const groups: string[][] = Array.from({ length: count }, () => []);
  ids.forEach((id, i) => {
    const lap = Math.floor(i / count);
    const idx = lap % 2 === 0 ? i % count : count - 1 - (i % count);
    (groups[idx] as string[]).push(id);
  });
  return groups;
}

export class FixtureError extends Error {}

export function generateFixtures(
  format: TournamentFormat,
  participants: readonly ParticipantRef[],
  settings: TournamentSettings,
): FixturePlan {
  const ids = participants.map((p) => p.id);
  if (format !== "friendlies" && ids.length < 4) {
    throw new FixtureError("Se necesitan al menos 4 participantes");
  }
  if (ids.length > 32) throw new FixtureError("El máximo es 32 participantes");

  const plan: FixturePlan = { matches: [], brackets: [], groups: {} };

  switch (format) {
    case "league":
    case "league_double": {
      const rounds = roundRobin(ids, format === "league_double");
      const half = rounds.length / 2;
      for (const rd of rounds) {
        rd.pairs.forEach(([home, away], i) => {
          plan.matches.push({
            id: uid(),
            stage: "league",
            round: rd.round,
            position: i + 1,
            leg: format === "league_double" && rd.round > half ? 2 : 1,
            home_id: home,
            away_id: away,
          });
        });
      }
      return plan;
    }
    case "cup": {
      const size = Math.max(4, nextPow2(ids.length));
      const ko = buildKnockout(size, ids, ids.length, "knockout", settings.third_place, false);
      plan.matches = ko.matches;
      plan.brackets = [
        { kind: "knockout", rounds: Math.log2(size), has_third_place: Boolean(ko.thirdPlace) },
      ];
      return plan;
    }
    case "double_elimination": {
      const de = buildDoubleElimination(ids);
      plan.matches = de.matches;
      plan.brackets = de.brackets;
      return plan;
    }
    case "groups_playoffs": {
      const groups = snakeGroups(ids, settings.group_size);
      const q = settings.qualifiers_per_group;
      const smallest = Math.min(...groups.map((g) => g.length));
      if (q < 1 || q > smallest) {
        throw new FixtureError(`Clasifican ${q} por grupo, pero el grupo más pequeño tiene ${smallest} jugadores`);
      }
      groups.forEach((members, gi) => {
        const name = String.fromCharCode(65 + gi);
        members.forEach((id) => (plan.groups[id] = name));
        for (const rd of roundRobin(members, false)) {
          rd.pairs.forEach(([home, away], i) => {
            plan.matches.push({
              id: uid(),
              stage: "group",
              group_name: name,
              round: rd.round,
              position: i + 1,
              leg: 1,
              home_id: home,
              away_id: away,
            });
          });
        }
      });
      const qualifiers = groups.length * q;
      const size = Math.max(2, nextPow2(qualifiers));
      if (size >= 2) {
        const ko = buildKnockout(size, [], qualifiers, "knockout", settings.third_place && size >= 4, true);
        plan.matches.push(...ko.matches);
        plan.brackets = [
          { kind: "playoffs", rounds: Math.log2(size), has_third_place: Boolean(ko.thirdPlace) },
        ];
      }
      return plan;
    }
    case "friendlies":
      return plan;
  }
}

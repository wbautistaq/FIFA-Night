import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { generateFixtures } from "@/lib/engine/fixtures";
import { DEFAULT_SETTINGS, type TournamentFormat } from "@/lib/engine/types";
import { computeStandings } from "@/lib/engine/standings";

// Requiere un Postgres con las migraciones aplicadas (npm run db:test lo prepara).
const url = process.env.DATABASE_URL;
const d = url ? describe : describe.skip;

d("flujo de torneo en PostgreSQL (motor TS + triggers SQL)", () => {
  let c: Client;
  const owner = crypto.randomUUID();
  const other = crypto.randomUUID();

  const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
    (await c.query(sql, params)).rows as T[];
  const as = async (uid: string | null, role = "authenticated") => {
    await c.query("reset role");
    await c.query("select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', $2, false)", [uid ?? "", role]);
    if (uid) await c.query(`set role ${role === "service_role" ? "service_role" : "authenticated"}`);
  };

  beforeAll(async () => {
    c = new Client({ connectionString: url });
    await c.connect();
    await c.query("insert into auth.users (id, email) values ($1,'owner@x.co'),($2,'other@x.co') on conflict do nothing", [owner, other]);
  });
  afterAll(async () => {
    await c.query("reset role");
    await c.end();
  });

  async function setup(format: TournamentFormat, n: number, settings = {}) {
    await as(owner);
    const [t] = await q<{ id: string }>(
      "insert into tournaments (owner_id,name,format,max_players,settings) values ($1,$2,$3,32,$4) returning id",
      [owner, `Torneo ${format}`, format, { ...DEFAULT_SETTINGS, ...settings }],
    );
    const tid = (t as { id: string }).id;
    await q("update tournaments set status='registration' where id=$1", [tid]);
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const [p] = await q<{ id: string }>("insert into tournament_participants (tournament_id,display_name) values ($1,$2) returning id", [tid, `Jugador ${i + 1}`]);
      ids.push((p as { id: string }).id);
    }
    const plan = generateFixtures(format, ids.map((id, i) => ({ id, display_name: `Jugador ${i + 1}` })), { ...DEFAULT_SETTINGS, ...settings });
    for (const [pid, g] of Object.entries(plan.groups)) await q("update tournament_participants set group_name=$1 where id=$2", [g, pid]);
    await q("select start_tournament($1,$2::jsonb,$3::jsonb)", [tid, JSON.stringify(plan.matches), JSON.stringify(plan.brackets)]);
    return { tid, ids };
  }

  const play = async (matchId: string, h: number, a: number, pens?: [number, number]) =>
    q(
      "insert into match_results (match_id,home_score,away_score,home_pens,away_pens,status,reported_by_organizer) values ($1,$2,$3,$4,$5,'confirmed',true)",
      [matchId, h, a, pens?.[0] ?? null, pens?.[1] ?? null],
    );

  it("liga: tabla en SQL coincide con la del motor TS y el torneo se cierra con campeón", async () => {
    const { tid, ids } = await setup("league", 5);
    const matches = await q<{ id: string; home_id: string; away_id: string }>("select id,home_id,away_id from matches where tournament_id=$1 order by round,position", [tid]);
    expect(matches).toHaveLength(10);
    const played: Array<{ homeId: string; awayId: string; result: { home_score: number; away_score: number } }> = [];
    let i = 0;
    for (const m of matches) {
      const h = (i * 3) % 4, a = (i * 5) % 3;
      await play(m.id, h, a);
      played.push({ homeId: m.home_id, awayId: m.away_id, result: { home_score: h, away_score: a } });
      i++;
    }
    const rows = await q<{ participant_id: string; position: number; points: number }>("select participant_id,position,points from standings where tournament_id=$1 order by position", [tid]);
    const ts = computeStandings(ids.map((id, k) => ({ id, name: `Jugador ${k + 1}` })), played);
    expect(rows.map((r) => r.participant_id)).toEqual(ts.map((r) => r.participantId));
    expect(rows.map((r) => r.points)).toEqual(ts.map((r) => r.points));
    const [t] = await q<{ status: string; champion_participant_id: string }>("select status,champion_participant_id from tournaments where id=$1", [tid]);
    expect(t?.status).toBe("finished");
    expect(t?.champion_participant_id).toBe(rows[0]?.participant_id);
    const ach = await q("select code from achievements where tournament_id=$1", [tid]);
    expect(ach.length).toBeGreaterThan(0);
  });

  it("resultado reportado (no confirmado) no altera tabla; confirmado sí; duplicado se rechaza", async () => {
    const { tid } = await setup("league", 4);
    const [m] = await q<{ id: string }>("select id from matches where tournament_id=$1 limit 1", [tid]);
    await q("insert into match_results (match_id,home_score,away_score,status,reported_by_organizer) values ($1,2,0,'reported',true)", [(m as { id: string }).id]);
    expect((await q<{ s: string }>("select sum(played)::text s from standings where tournament_id=$1", [tid]))[0]?.s).toBe("0");
    await q("update match_results set status='confirmed' where match_id=$1", [(m as { id: string }).id]);
    expect((await q<{ s: string }>("select sum(points)::text s from standings where tournament_id=$1", [tid]))[0]?.s).toBe("3");
    await expect(q("insert into match_results (match_id,home_score,away_score,status) values ($1,1,1,'confirmed')", [(m as { id: string }).id])).rejects.toThrow();
  });

  it("predicciones: una predicción de un partido sin jugar no bloquea otros resultados y la acertada suma 5", async () => {
    const { tid, ids } = await setup("league", 4);
    const ms = await q<{ id: string; home_id: string; away_id: string }>("select id,home_id,away_id from matches where tournament_id=$1 order by round,position", [tid]);
    const [first, second] = ms as { id: string; home_id: string; away_id: string }[];
    const tipster = ids.find((p) => ![second!.home_id, second!.away_id].includes(p))!;
    await q("insert into predictions (tournament_id,match_id,participant_id,predicted_winner_id,home_score,away_score) values ($1,$2,$3,$4,1,0)", [tid, second!.id, tipster, second!.home_id]);
    await play(first!.id, 2, 0);
    expect((await q<{ settled: boolean; points: number }>("select settled,points from predictions where match_id=$1", [second!.id]))[0]).toEqual({ settled: false, points: 0 });
    await play(second!.id, 1, 0);
    expect((await q<{ settled: boolean; points: number }>("select settled,points from predictions where match_id=$1", [second!.id]))[0]).toEqual({ settled: true, points: 5 });
  });

  it("copa de 6 con byes: avanza ganadores, exige penales y declara campeón", async () => {
    const { tid } = await setup("cup", 6);
    const pending = async () => q<{ id: string; stage: string }>("select id,stage from matches where tournament_id=$1 and status='pending' and home_id is not null and away_id is not null order by round,position", [tid]);
    let guard = 0;
    while ((await pending()).length && guard++ < 20) {
      for (const m of await pending()) {
        if (guard === 1) await expect(play(m.id, 1, 1)).rejects.toThrow(/penales/);
        await play(m.id, 2, 1);
      }
    }
    const [t] = await q<{ status: string; champion_participant_id: string | null }>("select status,champion_participant_id from tournaments where id=$1", [tid]);
    expect(t?.status).toBe("finished");
    expect(t?.champion_participant_id).not.toBeNull();
  });

  it("copa: empate con penales avanza al ganador por penales", async () => {
    const { tid } = await setup("cup", 4);
    const [m] = await q<{ id: string; away_id: string; next_match_id: string }>("select id,away_id,next_match_id from matches where tournament_id=$1 and round=1 order by position limit 1", [tid]);
    await play((m as { id: string }).id, 1, 1, [3, 4]);
    const [n] = await q<{ home_id: string; away_id: string }>("select home_id,away_id from matches where id=$1", [(m as { next_match_id: string }).next_match_id]);
    expect([n?.home_id, n?.away_id]).toContain((m as { away_id: string }).away_id);
  });

  it("corregir un resultado no se permite si cambia el ganador y la siguiente ronda ya se jugó", async () => {
    const { tid } = await setup("cup", 4);
    const r1 = await q<{ id: string }>("select id from matches where tournament_id=$1 and round=1 order by position", [tid]);
    for (const m of r1) await play(m.id, 2, 0);
    const [fin] = await q<{ id: string }>("select id from matches where tournament_id=$1 and round=2", [tid]);
    await play((fin as { id: string }).id, 1, 0);
    await expect(q("update match_results set home_score=0, away_score=3 where match_id=$1", [(r1[0] as { id: string }).id])).rejects.toThrow(/siguiente partido/);
  });

  it("doble eliminación de 8 se juega completa hasta la gran final", async () => {
    const { tid } = await setup("double_elimination", 8);
    let guard = 0;
    for (;;) {
      const next = await q<{ id: string }>("select id from matches where tournament_id=$1 and status='pending' and home_id is not null and away_id is not null order by round,position limit 1", [tid]);
      if (!next[0] || guard++ > 40) break;
      await play(next[0].id, 3, 1);
    }
    const [t] = await q<{ status: string }>("select status from tournaments where id=$1", [tid]);
    expect(t?.status).toBe("finished");
    const [gf] = await q<{ winner_id: string | null }>("select winner_id from matches where tournament_id=$1 and stage='grand_final'", [tid]);
    expect(gf?.winner_id).not.toBeNull();
  });

  it("doble eliminación de 5 (con byes) también termina", async () => {
    const { tid } = await setup("double_elimination", 5);
    let guard = 0;
    for (;;) {
      const next = await q<{ id: string }>("select id from matches where tournament_id=$1 and status='pending' and home_id is not null and away_id is not null order by round,position limit 1", [tid]);
      if (!next[0] || guard++ > 40) break;
      await play(next[0].id, 2, 0);
    }
    const [t] = await q<{ status: string }>("select status from tournaments where id=$1", [tid]);
    expect(t?.status).toBe("finished");
  });

  it("grupos + playoffs: tras la fase de grupos se llenan los cruces", async () => {
    const { tid } = await setup("groups_playoffs", 8);
    const groupMatches = await q<{ id: string }>("select id from matches where tournament_id=$1 and stage='group'", [tid]);
    for (const [i, m] of groupMatches.entries()) await play(m.id, i % 3, (i + 1) % 2);
    const semis = await q<{ home_id: string | null; away_id: string | null }>("select home_id,away_id from matches where tournament_id=$1 and stage='knockout' and round=1", [tid]);
    expect(semis).toHaveLength(2);
    expect(semis.every((s) => s.home_id && s.away_id)).toBe(true);
    let guard = 0;
    for (;;) {
      const next = await q<{ id: string }>("select id from matches where tournament_id=$1 and status='pending' and home_id is not null and away_id is not null order by round,position limit 1", [tid]);
      if (!next[0] || guard++ > 10) break;
      await play(next[0].id, 2, 0);
    }
    expect((await q<{ status: string }>("select status from tournaments where id=$1", [tid]))[0]?.status).toBe("finished");
  });

  it("RLS: jugador reporta, solo el rival confirma, otros no ven el torneo", async () => {
    const { tid } = await setup("league", 4, { player_reporting: true });
    await as(owner);
    const players = await q<{ id: string }>("select id from tournament_participants where tournament_id=$1 order by display_name", [tid]);
    await q("update tournament_participants set user_id=$1 where id=$2", [other, (players[0] as { id: string }).id]);
    const [m] = await q<{ id: string; home_id: string; away_id: string }>("select id,home_id,away_id from matches where tournament_id=$1 and (home_id=$2 or away_id=$2) limit 1", [tid, (players[0] as { id: string }).id]);
    const mine = (players[0] as { id: string }).id;
    const match = m as { id: string; home_id: string; away_id: string };
    expect(match.home_id === mine || match.away_id === mine).toBe(true);

    await as(other);
    await q("insert into match_results (match_id,home_score,away_score,status,reported_by) values ($1,1,0,'reported',$2)", [match.id, mine]);
    // quien reportó no puede confirmar su propio resultado
    await expect(q("update match_results set status='confirmed' where match_id=$1", [match.id])).rejects.toThrow();
    // un tercero sin relación no ve el torneo
    const stranger = crypto.randomUUID();
    await as(null);
    await c.query("insert into auth.users (id,email) values ($1,'s@x.co')", [stranger]);
    await as(stranger);
    expect(await q("select id from tournaments where id=$1", [tid])).toHaveLength(0);
    expect(await q("select id from matches where tournament_id=$1", [tid])).toHaveLength(0);
    // organizador resuelve
    await as(owner);
    await q("update match_results set status='confirmed' where match_id=$1", [match.id]);
    expect((await q<{ s: string }>("select sum(played)::text s from standings where tournament_id=$1", [tid]))[0]?.s).toBe("2");
  });

  it("RLS: no se puede borrar un torneo iniciado ni editar su formato", async () => {
    const { tid } = await setup("league", 4);
    await as(owner);
    expect(await q("delete from tournaments where id=$1 returning id", [tid])).toHaveLength(0);
    await expect(q("update tournaments set format='cup' where id=$1", [tid])).rejects.toThrow(/configuración/);
  });
});

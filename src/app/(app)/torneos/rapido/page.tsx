"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { CaretLeft, Lightning, Plus, X } from "@phosphor-icons/react";
import { quickTournament, type QuickTournamentInput } from "@/app/actions/tournaments";
import { Field, Toggle } from "@/components/ui/primitives";

const FORMATS: { value: QuickTournamentInput["format"]; label: string; hint: string }[] = [
  { value: "league", label: "Liga", hint: "Todos contra todos" },
  { value: "cup", label: "Copa", hint: "Eliminación directa" },
  { value: "league_double", label: "Ida y vuelta", hint: "Liga doble" },
  { value: "swiss", label: "Suizo", hint: "Rondas por nivel" },
];
const TEAMS: { value: QuickTournamentInput["teams"]; label: string }[] = [
  { value: "clubs", label: "Clubes" },
  { value: "national", label: "Selecciones" },
  { value: "all", label: "Ambos" },
];

/** Torneo relámpago: nombres → equipos sorteados → calendario listo, en un toque. */
export default function QuickTournamentPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [draft, setDraft] = useState("");
  const [players, setPlayers] = useState<string[]>([]);
  const [includeMe, setIncludeMe] = useState(true);
  const [format, setFormat] = useState<QuickTournamentInput["format"]>("league");
  const [teams, setTeams] = useState<QuickTournamentInput["teams"]>("clubs");
  const [minStars, setMinStars] = useState(4);
  const [balanced, setBalanced] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const total = players.length + (includeMe ? 1 : 0);

  // Acepta varios nombres a la vez separados por comas o saltos de línea
  function add() {
    const names = draft.split(/[,\n]/).map((n) => n.trim()).filter(Boolean);
    if (!names.length) return;
    setPlayers((prev) => {
      const seen = new Set(prev.map((p) => p.toLowerCase()));
      return [...prev, ...names.filter((n) => !seen.has(n.toLowerCase()) && seen.add(n.toLowerCase()))].slice(0, 31);
    });
    setDraft("");
  }

  async function go() {
    setBusy(true);
    setError("");
    const r = await quickTournament({ name, players, includeMe, format, teams, minStars, balanced });
    if (!r.ok || !r.data) {
      setBusy(false);
      return setError(r.ok ? "No se pudo crear el torneo" : r.error);
    }
    router.push(`/t/${r.data.id}`);
  }

  return (
    <div className="space-y-5">
      <Link href="/" className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold uppercase tracking-wider text-white/60 hover:text-white"><CaretLeft size={14} weight="bold" aria-hidden />Volver</Link>
      <header>
        <p className="eyebrow flex items-center gap-1"><Lightning size={14} weight="fill" aria-hidden />En 30 segundos</p>
        <h1 className="text-3xl uppercase">Torneo relámpago</h1>
        <p className="mt-1 text-sm text-white/70">Escribe quién juega y listo: sorteamos equipos de FC 26, armamos el calendario y arranca. Nadie necesita cuenta.</p>
      </header>

      <section className="card space-y-3" aria-labelledby="qp">
        <h2 id="qp" className="text-lg uppercase">Jugadores <span className="font-sans text-sm normal-case text-white/60">({total})</span></h2>
        <Toggle id="q-me" label="Yo también juego" checked={includeMe} onChange={setIncludeMe} />
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <label htmlFor="q-add" className="sr-only">Nombre del jugador</label>
          <input id="q-add" className="input" placeholder="Ana, Beto, Carla…" value={draft} onChange={(e) => setDraft(e.target.value)} autoComplete="off" />
          <button className="btn-secondary !min-h-12 !w-12 !px-0" aria-label="Agregar jugador" disabled={!draft.trim()}><Plus size={22} weight="bold" aria-hidden /></button>
        </form>
        <p className="help">Puedes pegar varios nombres separados por comas.</p>
        {players.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Jugadores agregados">
            {players.map((p) => (
              <li key={p} className="inline-flex min-h-10 items-center gap-1 rounded-full border border-white/15 bg-white/[.06] pl-3 pr-1 text-sm font-semibold">
                {p}
                <button type="button" className="grid h-8 w-8 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white" aria-label={`Quitar a ${p}`} onClick={() => setPlayers(players.filter((x) => x !== p))}><X size={14} weight="bold" aria-hidden /></button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-4" aria-labelledby="qf">
        <h2 id="qf" className="text-lg uppercase">Formato y equipos</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Formato">
          {FORMATS.map((f) => (
            <button key={f.value} type="button" role="radio" aria-checked={format === f.value} onClick={() => setFormat(f.value)} className={clsx("flex min-h-16 flex-col items-center justify-center rounded-xl border px-1 text-center transition", format === f.value ? "border-neon bg-neon/10 text-neon shadow-glow-neon" : "border-white/15 bg-white/[.04] hover:border-white/30")}>
              <span className="font-display text-sm uppercase">{f.label}</span><span className="text-[11px] text-white/60">{f.hint}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de equipos">
          {TEAMS.map((t) => (
            <button key={t.value} type="button" role="radio" aria-checked={teams === t.value} onClick={() => setTeams(t.value)} className={clsx("min-h-11 rounded-xl border text-sm font-semibold transition", teams === t.value ? "border-volt-light bg-volt/30" : "border-white/15 bg-white/[.04] hover:border-white/30")}>{t.label}</button>
          ))}
        </div>
        <Field label="Estrellas mínimas de los equipos" htmlFor="q-stars">
          <select id="q-stars" className="input" value={minStars} onChange={(e) => setMinStars(Number(e.target.value))}>
            <option value={0}>Cualquiera</option>
            {[5, 4.5, 4, 3.5, 3].map((s) => <option key={s} value={s}>{s} ★ o más</option>)}
          </select>
        </Field>
        <Toggle id="q-bal" label="Equipos parejos" help="Equipos con estrellas parecidas para todos" checked={balanced} onChange={setBalanced} />
        <Field label="Nombre del torneo (opcional)" htmlFor="q-name">
          <input id="q-name" className="input" placeholder="Noche FIFA" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </Field>
      </section>

      {error ? <p role="alert" className="error-text text-center">{error}</p> : null}
      <button className="btn-primary w-full !min-h-14 text-lg" onClick={go} disabled={busy || total < 4}>
        <Lightning size={22} weight="fill" aria-hidden />{busy ? "Armando el torneo…" : total < 4 ? `Faltan ${4 - total} jugadores` : "¡Arrancar!"}
      </button>
    </div>
  );
}

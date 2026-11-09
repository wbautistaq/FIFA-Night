"use client";

import { useMemo, useState } from "react";
import { DateTimeField } from "@/components/DateTimeField";
import { Field, Toggle, useToast } from "@/components/ui/primitives";
import { tournamentInputSchema, type TournamentInput } from "@/lib/schemas";
import { DEFAULT_SETTINGS } from "@/lib/engine/types";
import { FORMAT_LABEL, PLATFORM_LABEL } from "@/lib/labels";
import { colombiaInputToIso, defaultStartInput } from "@/lib/datetime";

const FORMAT_HELP: Record<TournamentInput["format"], string> = {
  league: "Todos juegan contra todos una vez. Gana quien más puntos sume.",
  league_double: "Todos contra todos con partido de ida y de vuelta.",
  cup: "Eliminación directa: el que pierde, queda fuera.",
  double_elimination: "Tienes que perder dos veces para quedar eliminado.",
  groups_playoffs: "Fase de grupos y luego llaves entre los clasificados.",
  friendlies: "Partidos sueltos que tú programas, con tabla acumulada.",
  swiss: "Varias rondas: en cada una juegas contra alguien con tus mismos puntos y nunca repites rival.",
};

export function defaultTournamentInput(): TournamentInput {
  return { name: "", starts_at: defaultStartInput(), platform: "presencial", format: "league", max_players: 8, rules: "", settings: DEFAULT_SETTINGS };
}

export function TournamentForm({ initial, submitLabel, onSubmit, lockFormat }: { initial: TournamentInput; submitLabel: string; onSubmit: (v: TournamentInput) => Promise<string | null>; lockFormat?: boolean }) {
  const [v, setV] = useState<TournamentInput>(initial);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const toast = useToast();

  const parsed = useMemo(() => tournamentInputSchema.safeParse(v), [v]);
  const errors = useMemo(() => {
    const out: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) out[String(i.path[0])] ??= i.message;
    return out;
  }, [parsed]);
  const err = (k: string) => (touched[k] ? errors[k] : undefined);
  const set = <K extends keyof TournamentInput>(k: K, val: TournamentInput[K]) => setV((p) => ({ ...p, [k]: val }));
  const setS = (patch: Partial<TournamentInput["settings"]>) => setV((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
  const touch = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ name: true, max_players: true, starts_at: true });
    if (!parsed.success) return;
    setBusy(true);
    setServerError(null);
    const message = await onSubmit({ ...parsed.data, starts_at: colombiaInputToIso(parsed.data.starts_at) });
    setBusy(false);
    if (message) {
      setServerError(message);
      toast.show("error", message);
    }
  }

  const isGroups = v.format === "groups_playoffs";
  const isKnockout = v.format === "cup" || isGroups;

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Field label="Nombre del torneo" htmlFor="name" error={err("name")}>
        <input id="name" className="input" value={v.name} maxLength={80} placeholder="Copa de los parceros" onChange={(e) => set("name", e.target.value)} onBlur={touch("name")} aria-invalid={Boolean(err("name"))} autoFocus />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fecha y hora" htmlFor="starts" error={err("starts_at")}>
          <DateTimeField id="starts" defaultValue={v.starts_at} onChange={(value) => set("starts_at", value)} onBlur={touch("starts_at")} />
        </Field>
        <Field label="Máximo de jugadores" htmlFor="max" error={err("max_players")} help="Entre 4 y 32">
          <input id="max" type="number" inputMode="numeric" min={4} max={32} className="input" value={v.max_players} onChange={(e) => set("max_players", Number(e.target.value))} onBlur={touch("max_players")} />
        </Field>
      </div>
      <fieldset>
        <legend className="label">Plataforma</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(PLATFORM_LABEL) as TournamentInput["platform"][]).map((p) => (
            <button key={p} type="button" aria-pressed={v.platform === p} onClick={() => set("platform", p)} className={v.platform === p ? "btn bg-volt text-white" : "btn-secondary"}>{PLATFORM_LABEL[p]}</button>
          ))}
        </div>
      </fieldset>
      <Field label="Formato" htmlFor="format" help={FORMAT_HELP[v.format]}>
        <select id="format" className="input" value={v.format} disabled={lockFormat} onChange={(e) => set("format", e.target.value as TournamentInput["format"])}>
          {(Object.keys(FORMAT_LABEL) as TournamentInput["format"][]).map((f) => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}
        </select>
      </Field>

      {v.format === "swiss" && (
        <Field label="Número de rondas" htmlFor="srounds" help="Con 8 jugadores, 3 rondas bastan para tener un campeón claro.">
          <input id="srounds" type="number" inputMode="numeric" min={2} max={10} className="input" value={v.settings.swiss_rounds ?? 3} onChange={(e) => setS({ swiss_rounds: Number(e.target.value) })} />
        </Field>
      )}

      {isGroups && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Jugadores por grupo" htmlFor="gsize"><input id="gsize" type="number" min={3} max={8} className="input" value={v.settings.group_size} onChange={(e) => setS({ group_size: Number(e.target.value) })} /></Field>
          <Field label="Clasifican por grupo" htmlFor="gq" error={v.settings.qualifiers_per_group > v.settings.group_size ? "No pueden clasificar más que el tamaño del grupo" : undefined}><input id="gq" type="number" min={1} max={4} className="input" value={v.settings.qualifiers_per_group} onChange={(e) => setS({ qualifiers_per_group: Number(e.target.value) })} /></Field>
        </div>
      )}

      <div className="space-y-2">
        {isKnockout && <Toggle id="third" label="Partido por el tercer puesto" checked={v.settings.third_place} onChange={(x) => setS({ third_place: x })} />}
        <Toggle id="pen" label="Penales si hay empate (eliminatorias)" checked={v.settings.penalties} onChange={(x) => setS({ penalties: x })} help="En llaves un empate siempre se define por penales" />
        <Toggle id="rep" label="Los jugadores reportan sus resultados" checked={v.settings.player_reporting} onChange={(x) => setS({ player_reporting: x })} help="El rival debe confirmarlos; si no coinciden, decides tú" />
        <Toggle id="fp" label="Puntos del Parche y logros" checked={v.settings.fifa_points} onChange={(x) => setS({ fifa_points: x })} />
        <Toggle id="pred" label="Predicciones" checked={v.settings.predictions} onChange={(x) => setS({ predictions: x })} help="Los espectadores suman puntos por acertar" />
        {v.settings.predictions && <Toggle id="exact" label="Puntos extra por marcador exacto" checked={v.settings.exact_score_predictions} onChange={(x) => setS({ exact_score_predictions: x })} />}
        <Toggle id="wall" label="Muro del torneo" checked={v.settings.wall} onChange={(x) => setS({ wall: x })} />
        <Toggle id="acc" label="Solo jugadores con cuenta" checked={Boolean(v.settings.accounts_only)} onChange={(x) => setS({ accounts_only: x })} help="Sin invitados: todos los partidos quedan en el perfil de cada jugador" />
      </div>

      <Field label="Reglas" htmlFor="rules" help="Duración de partidos, dificultad, equipos permitidos…">
        <textarea id="rules" rows={3} maxLength={2000} className="input py-3" value={v.rules} onChange={(e) => set("rules", e.target.value)} />
      </Field>

      {serverError ? <p role="alert" className="error-text">{serverError}</p> : null}
      <button className="btn-primary w-full" disabled={busy || !parsed.success || (isGroups && v.settings.qualifiers_per_group > v.settings.group_size)}>{busy ? "Guardando…" : submitLabel}</button>
      {toast.node}
    </form>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { CheckCircle, MagnifyingGlass, Plus, UserCircleDashed, X } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/primitives";
import { findPlayers, myPlayers, type PlayerOption } from "@/app/actions/players";

export type PickedPlayer =
  | { kind: "user"; userId: string; name: string; avatarUrl: string | null }
  | { kind: "guest"; name: string };

const keyOf = (p: PickedPlayer) => (p.kind === "user" ? `u:${p.userId}` : `g:${p.name.toLowerCase()}`);
const optionName = (o: PlayerOption) => o.nickname || o.displayName;

/**
 * Elegir jugadores: primero los que tienen cuenta ("mis jugadores" y búsqueda por apodo);
 * los invitados se escriben a mano como excepción y no tienen perfil propio.
 */
export function PlayerPicker({ value, onChange, allowGuests = true, excludeUserIds, excludeNames, max }: {
  value: PickedPlayer[];
  onChange: (v: PickedPlayer[]) => void;
  allowGuests?: boolean;
  /** Ya están en el torneo. */
  excludeUserIds?: ReadonlySet<string>;
  excludeNames?: ReadonlySet<string>;
  max?: number;
}) {
  const [friends, setFriends] = useState<PlayerOption[] | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerOption[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => { myPlayers().then((r) => setFriends(r.ok ? (r.data ?? []) : [])); }, []);

  // Búsqueda por apodo con una pequeña espera para no consultar en cada letra
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3 || q.includes(",")) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      const r = await findPlayers(q);
      setResults(r.ok ? (r.data ?? []) : []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const picked = useMemo(() => new Set(value.map(keyOf)), [value]);
  const full = max !== undefined && value.length >= max;
  const taken = (o: PlayerOption) => picked.has(`u:${o.userId}`) || Boolean(excludeUserIds?.has(o.userId));
  const nameTaken = (n: string) => value.some((p) => p.name.toLowerCase() === n.toLowerCase()) || Boolean(excludeNames?.has(n.toLowerCase()));

  function addUser(o: PlayerOption) {
    if (taken(o) || full) return;
    onChange([...value, { kind: "user", userId: o.userId, name: optionName(o), avatarUrl: o.avatarUrl }]);
    setQuery("");
  }
  function toggleUser(o: PlayerOption) {
    if (picked.has(`u:${o.userId}`)) onChange(value.filter((p) => !(p.kind === "user" && p.userId === o.userId)));
    else addUser(o);
  }
  function addGuests(raw: string) {
    const names = raw.split(/[,\n]/).map((n) => n.trim()).filter((n) => n.length > 0 && n.length <= 40);
    const next = [...value];
    for (const n of names) {
      if (max !== undefined && next.length >= max) break;
      if (!next.some((p) => p.name.toLowerCase() === n.toLowerCase()) && !excludeNames?.has(n.toLowerCase())) next.push({ kind: "guest", name: n });
    }
    onChange(next);
    setQuery("");
  }

  const q = query.trim();
  const exact = results.find((o) => optionName(o).toLowerCase() === q.toLowerCase());
  function submit() {
    if (!q) return;
    if (exact && !taken(exact)) return addUser(exact);
    if (allowGuests) addGuests(q);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="pp-q" className="label">Buscar jugador</label>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <span className="relative flex-1">
            <MagnifyingGlass size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/50" aria-hidden />
            <input id="pp-q" className="input pl-10" autoComplete="off" placeholder={allowGuests ? "Apodo, o nombre de un invitado" : "Apodo del jugador"}
              value={query} onChange={(e) => setQuery(e.target.value)} disabled={full} aria-describedby="pp-help" />
          </span>
          <button className="btn-secondary !min-h-12 !w-12 !px-0" aria-label="Agregar" disabled={!q || full}><Plus size={22} weight="bold" aria-hidden /></button>
        </form>
        <p id="pp-help" className="help !mt-0">
          {full ? `Llegaste al máximo de ${max} jugadores.` : allowGuests ? "Busca por apodo a quien tiene cuenta. Si no tiene, escribe su nombre: entra como invitado." : "Este torneo es solo para jugadores con cuenta: búscalos por su apodo."}
        </p>

        {q.length >= 3 && !q.includes(",") && (
          <ul className="space-y-1.5" aria-live="polite">
            {results.map((o) => (
              <li key={o.userId}>
                <button type="button" disabled={taken(o) || full} onClick={() => addUser(o)} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[.04] p-2 text-left transition hover:border-neon disabled:opacity-50">
                  <Avatar name={optionName(o)} url={o.avatarUrl} size={34} />
                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{optionName(o)}</span>{o.nickname && o.displayName !== o.nickname ? <span className="block truncate text-xs text-white/55">{o.displayName}</span> : null}</span>
                  {taken(o) ? <CheckCircle size={20} weight="fill" className="text-neon" aria-label="Ya agregado" /> : <span className="chip border-neon/50 text-neon">Agregar</span>}
                </button>
              </li>
            ))}
            {searching ? <li className="help">Buscando…</li> : null}
            {!searching && allowGuests && !exact && !nameTaken(q) && (
              <li>
                <button type="button" disabled={full} onClick={() => addGuests(q)} className="flex w-full items-center gap-3 rounded-xl border border-dashed border-white/20 p-2 text-left text-sm transition hover:border-white/40">
                  <UserCircleDashed size={34} className="text-white/50" aria-hidden />
                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold">Agregar «{q}» como invitado</span><span className="block text-xs text-white/55">Sin cuenta: sus partidos no quedan en un perfil propio</span></span>
                </button>
              </li>
            )}
            {!searching && !allowGuests && results.length === 0 ? <li className="help">Nadie con ese apodo.</li> : null}
          </ul>
        )}
      </div>

      {friends && friends.length > 0 && (
        <div className="space-y-2">
          <p className="label !mb-0">Mis jugadores</p>
          <ul className="flex flex-wrap gap-2">
            {friends.map((o) => {
              const on = picked.has(`u:${o.userId}`);
              const inTournament = excludeUserIds?.has(o.userId);
              return (
                <li key={o.userId}>
                  <button type="button" aria-pressed={on} disabled={inTournament || (!on && full)} onClick={() => toggleUser(o)}
                    className={clsx("inline-flex min-h-11 items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm font-semibold transition disabled:opacity-40", on ? "border-neon bg-neon/15 text-neon" : "border-white/15 bg-white/[.04] hover:border-white/30")}>
                    <Avatar name={optionName(o)} url={o.avatarUrl} size={30} />
                    {optionName(o)}
                    {on ? <CheckCircle size={16} weight="fill" aria-hidden /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {value.length > 0 && (
        <div className="space-y-2">
          <p className="label !mb-0">Seleccionados ({value.length})</p>
          <ul className="flex flex-wrap gap-2" aria-label="Jugadores seleccionados">
            {value.map((p) => (
              <li key={keyOf(p)} className={clsx("inline-flex min-h-10 items-center gap-2 rounded-full border py-1 pl-1 pr-1 text-sm font-semibold", p.kind === "user" ? "border-neon/40 bg-neon/10" : "border-dashed border-white/25 bg-white/[.04]")}>
                {p.kind === "user" ? <Avatar name={p.name} url={p.avatarUrl} size={28} /> : <UserCircleDashed size={28} className="text-white/50" aria-hidden />}
                <span>{p.name}</span>
                {p.kind === "guest" ? <span className="text-[10px] uppercase tracking-wide text-white/50">Invitado</span> : null}
                <button type="button" className="grid h-8 w-8 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white" aria-label={`Quitar a ${p.name}`} onClick={() => onChange(value.filter((x) => keyOf(x) !== keyOf(p)))}><X size={14} weight="bold" aria-hidden /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

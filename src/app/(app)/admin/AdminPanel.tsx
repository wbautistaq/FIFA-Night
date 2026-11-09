"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Copy, ShieldCheck, UserPlus } from "@phosphor-icons/react";
import { ActionButton, EmptyState, Field, useToast } from "@/components/ui/primitives";
import { FORMAT_LABEL, STATUS_LABEL } from "@/lib/labels";
import type { TournamentFormat } from "@/lib/engine/types";
import type { TournamentStatus } from "@/lib/types";
import type { ActionResult } from "@/lib/actor";
import {
  adminAddStaff, adminCancelTournament, adminCreateUser, adminDeleteTournament, adminDeleteUser, adminGenerateAccessCode,
  adminRecomputeTournament, adminRevokeSession, adminRevokeSessions, adminSetBan, adminSetRole, adminSetTheme, type AdminOverview, type AdminUser,
} from "@/app/actions/admin";
import { SessionsTab } from "./SessionsTab";
import { AppearanceTab } from "./AppearanceTab";
import { TeamTab } from "./TeamTab";
import { ReportsTab } from "./ReportsTab";
import { resolveReport } from "@/app/actions/moderation";
import type { StaffRole } from "@/lib/staff";
import { formatFullDateTime } from "@/lib/datetime";

const ADMIN_TABS = ["Resumen", "Reportes", "Usuarios", "Equipo", "Sesiones", "Torneos", "Apariencia", "Registro"] as const;
const MODERATOR_TABS = ["Resumen", "Reportes", "Usuarios", "Torneos"] as const;
type Tab = (typeof ADMIN_TABS)[number];
const ROLE_LABEL: Record<StaffRole, string> = { admin: "Administrador", moderator: "Moderador" };

const when = (iso: string | null) => (iso ? formatFullDateTime(iso) : "Nunca");

/** Panel del equipo de la plataforma. Cada acción se valida (rol + 2FA) y se registra en el servidor. */
export function AdminPanel({ data, selfId }: { data: AdminOverview; selfId: string }) {
  const isAdmin = data.viewerRole === "admin";
  const tabs: readonly Tab[] = isAdmin ? ADMIN_TABS : MODERATOR_TABS;
  const openReports = (data.reports ?? []).filter((r) => r.status === "open").length;
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("Resumen");
  const [query, setQuery] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [creating, setCreating] = useState(false);
  // Código recién generado: se muestra una sola vez y no queda guardado en ningún sitio
  const [secret, setSecret] = useState<{ email: string; code: string } | null>(null);

  const users = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? data.users.filter((u) => `${u.email ?? ""} ${u.name ?? ""}`.toLowerCase().includes(q)) : data.users;
  }, [data.users, query]);

  async function run<T>(p: Promise<ActionResult<T>>, success: string | ((d: T | undefined) => string)) {
    const r = await p;
    if (!r.ok) return toast.show("error", r.error), undefined;
    toast.show("success", typeof success === "function" ? success(r.data) : success);
    router.refresh();
    return r.data;
  }

  async function genCode(u: AdminUser) {
    const d = await run(adminGenerateAccessCode(u.id), "Código generado");
    if (d) setSecret({ email: u.email ?? u.id, code: d.code });
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    const d = await run(adminCreateUser(newEmail), "Cuenta creada");
    setCreating(false);
    if (d) {
      setSecret({ email: newEmail.trim().toLowerCase(), code: d.code });
      setNewEmail("");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <ShieldCheck size={30} weight="duotone" className="text-neon" aria-hidden />
        <h1 className="text-3xl uppercase">Administración</h1>
        {!isAdmin && <span className="chip">Moderador</span>}
      </div>

      <div role="tablist" aria-label="Secciones" className="flex gap-1 overflow-x-auto rounded-xl bg-white/[.04] p-1">
        {tabs.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={clsx("min-h-11 flex-1 rounded-lg px-3 text-sm font-semibold transition", tab === t ? "bg-volt/30 text-white" : "text-white/65 hover:text-white")}>{t}{t === "Reportes" && openReports ? ` (${openReports})` : ""}</button>
        ))}
      </div>

      {secret && (
        <div role="status" className="card space-y-2 border-neon/50">
          <p className="text-sm text-white/75">Código de acceso de <b className="text-white">{secret.email}</b>. Cópialo ahora: no se volverá a mostrar.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-black/40 p-3 text-center font-mono text-lg tracking-wider text-neon">{secret.code}</code>
            <button className="btn-secondary !px-3" aria-label="Copiar código" onClick={async () => { await navigator.clipboard.writeText(secret.code); toast.show("success", "Copiado"); }}><Copy size={20} aria-hidden /></button>
          </div>
          <p className="help">La persona entra con su correo y este código en la pestaña Contraseña, y luego puede cambiarlo en su perfil.</p>
          <button className="btn-ghost w-full" onClick={() => setSecret(null)}>Listo, ya lo copié</button>
        </div>
      )}

      {tab === "Resumen" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {([
            ["Reportes abiertos", openReports],
            ["Usuarios", data.totals.users],
            ["En línea ahora", data.totals.onlineUsers],
            ["Torneos", data.totals.tournaments],
            ["En curso", data.totals.active],
            ["Partidos", data.totals.matches],
            ["Resultados", data.totals.results],
            ...(isAdmin ? [["Acciones registradas", data.log.length] as const] : []),
          ] as const).map(([label, n]) => (
            <div key={label} className="card text-center">
              <p className="tabular font-display text-3xl text-white">{n}</p>
              <p className="text-xs uppercase tracking-wide text-white/60">{label}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "Apariencia" && (
        <AppearanceTab appearance={data.appearance} onChange={async (theme) => { await run(adminSetTheme(theme), "Paleta aplicada a todo el sitio"); }} />
      )}

      {tab === "Reportes" && (
        <ReportsTab reports={data.reports} onResolve={async (r, action) => { await run(resolveReport(r.id, action), "Reporte atendido"); }} />
      )}

      {tab === "Equipo" && isAdmin && (
        <TeamTab users={data.users} selfId={selfId}
          onAdd={async (email, role) => {
            const r = await adminAddStaff(email, role);
            if (!r.ok) return toast.show("error", r.error), false;
            toast.show("success", `Agregado como ${ROLE_LABEL[role].toLowerCase()}. Verá el panel la próxima vez que entre.`);
            router.refresh();
            return true;
          }}
          onSetRole={async (u, role) => { await run(adminSetRole(u.id, role), role ? `Ahora es ${ROLE_LABEL[role].toLowerCase()}` : "Quitado del equipo"); }} />
      )}

      {tab === "Sesiones" && (
        <SessionsTab sessions={data.sessions}
          onRevokeOne={async (s) => { await run(adminRevokeSession(s.id), "Sesión cerrada"); }}
          onRevokeAll={async (userId) => { await run(adminRevokeSessions(userId), (d) => `Sesiones cerradas: ${d?.sessions ?? 0}`); }} />
      )}

      {tab === "Usuarios" && (
        <div className="space-y-4">
          {isAdmin && <form onSubmit={create} className="card space-y-3" noValidate>
            <h2 className="flex items-center gap-2 text-lg uppercase"><UserPlus size={20} aria-hidden /> Crear cuenta</h2>
            <Field label="Correo" htmlFor="new-email" help="Se crea confirmada, sin enviar correo, con un código de acceso.">
              <input id="new-email" type="email" autoComplete="off" className="input" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </Field>
            <button className="btn-secondary w-full" disabled={creating || !newEmail.includes("@")}>{creating ? "Creando…" : "Crear y generar código"}</button>
          </form>}

          <Field label="Buscar" htmlFor="user-q">
            <input id="user-q" type="search" className="input" placeholder={isAdmin ? "Correo o nombre" : "Nombre"} value={query} onChange={(e) => setQuery(e.target.value)} />
          </Field>

          {users.length === 0 ? <EmptyState title="Sin resultados" /> : (
            <ul className="space-y-3">
              {users.map((u) => {
                const self = u.id === selfId;
                return (
                  <li key={u.id} className="card space-y-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{u.name ?? "Sin nombre"} {self && <span className="text-white/50">(tú)</span>}</p>
                      <p className="break-all text-sm text-white/65">{u.email}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {u.role && <span className="chip border-neon/50 text-neon">{ROLE_LABEL[u.role]}</span>}
                        {u.banned && <span className="chip-live">Bloqueado</span>}
                        {u.mfa && <span className="chip">2FA</span>}
                        <span className="chip">{u.tournamentsOwned} torneos</span>
                      </div>
                      <p className="mt-2 text-xs text-white/50">Alta {when(u.createdAt)} · Último acceso {when(u.lastSignIn)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {isAdmin && <ActionButton className="btn-secondary !min-h-11 text-sm" onAction={() => genCode(u)} confirm={`¿Generar un código de acceso nuevo para ${u.email}? Reemplaza su contraseña actual.`}>Nuevo código</ActionButton>}
                      {isAdmin && <ActionButton className="btn-secondary !min-h-11 text-sm" onAction={async () => { await run(adminRevokeSessions(u.id), (d) => `Sesiones cerradas: ${d?.sessions ?? 0}`); }} confirm={`¿Cerrar todas las sesiones de ${u.email}?`}>Cerrar sesiones</ActionButton>}
                      {!self && !u.role && (
                        <>
                          <ActionButton className="btn-secondary !min-h-11 text-sm" onAction={() => run(adminSetBan(u.id, !u.banned), u.banned ? "Usuario desbloqueado" : "Usuario bloqueado")} confirm={u.banned ? `¿Desbloquear a ${u.name ?? u.email}?` : `¿Bloquear a ${u.name ?? u.email}? No podrá entrar hasta que lo desbloquees.`}>{u.banned ? "Desbloquear" : "Bloquear"}</ActionButton>
                          {isAdmin && <ActionButton className="btn-danger !min-h-11 text-sm" onAction={() => run(adminDeleteUser(u.id), "Usuario eliminado")} confirm={`¿Eliminar definitivamente la cuenta de ${u.email}? No se puede deshacer.`}>Eliminar</ActionButton>}
                        </>
                      )}
                    </div>
                    {!self && u.role && <p className="help !mt-0">Es parte del equipo: su rol se gestiona en la pestaña Equipo.</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {tab === "Torneos" && (data.tournaments.length === 0 ? <EmptyState title="No hay torneos" /> : (
        <ul className="space-y-3">
          {data.tournaments.map((t) => (
            <li key={t.id} className="card space-y-3">
              <div>
                <a href={`/t/${t.id}`} className="font-semibold text-white hover:text-neon">{t.name}</a>
                <p className="text-sm text-white/65">{FORMAT_LABEL[t.format as TournamentFormat] ?? t.format} · {t.players} jugadores · {t.matches} partidos</p>
                <p className="text-xs text-white/50">{STATUS_LABEL[t.status as TournamentStatus] ?? t.status} · Organiza {t.ownerName ?? "—"} · {when(t.createdAt)}</p>
              </div>
              <div className={clsx("grid gap-2", isAdmin ? "grid-cols-3" : "grid-cols-1")}>
                {isAdmin && <ActionButton className="btn-secondary !min-h-11 !px-2 text-sm" onAction={() => run(adminRecomputeTournament(t.id), "Tabla y estadísticas recalculadas")}>Recalcular</ActionButton>}
                <ActionButton className="btn-secondary !min-h-11 !px-2 text-sm" disabled={t.status === "cancelled" || t.status === "finished"} onAction={() => run(adminCancelTournament(t.id), "Torneo cancelado")} confirm={`¿Cancelar "${t.name}"?`}>Cancelar</ActionButton>
                {isAdmin && <ActionButton className="btn-danger !min-h-11 !px-2 text-sm" onAction={() => run(adminDeleteTournament(t.id), "Torneo eliminado")} confirm={`¿Eliminar "${t.name}" con todos sus partidos, fotos y comentarios? No se puede deshacer.`}>Eliminar</ActionButton>}
              </div>
            </li>
          ))}
        </ul>
      ))}

      {tab === "Registro" && (data.log.length === 0 ? <EmptyState title="Aún no hay acciones registradas" /> : (
        <ol className="space-y-2">
          {data.log.map((l) => (
            <li key={l.id} className="card !py-3">
              <p className="font-semibold text-white">{l.action}</p>
              <p className="break-all text-sm text-white/70">{Object.entries(l.details).map(([k, v]) => `${k}: ${String(v)}`).join(" · ") || l.targetId}</p>
              <p className="text-xs text-white/50">{when(l.createdAt)} · {l.adminEmail}</p>
            </li>
          ))}
        </ol>
      ))}

      {toast.node}
    </div>
  );
}

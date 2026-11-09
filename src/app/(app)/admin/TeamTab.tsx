"use client";

import { useState, type FormEvent } from "react";
import { UserPlus, Warning } from "@phosphor-icons/react";
import { ActionButton, Field } from "@/components/ui/primitives";
import type { AdminUser } from "@/app/actions/admin";
import type { StaffRole } from "@/lib/staff";

const LABEL: Record<StaffRole, string> = { admin: "Administrador", moderator: "Moderador" };

interface Props {
  users: AdminUser[];
  selfId: string;
  onAdd: (email: string, role: StaffRole) => Promise<boolean>;
  onSetRole: (user: AdminUser, role: StaffRole | null) => Promise<void>;
}

/** Equipo de la plataforma: quién administra y quién modera. No depende de ninguna cuenta en particular. */
export function TeamTab({ users, selfId, onAdd, onSetRole }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("admin");
  const [adding, setAdding] = useState(false);

  const staff = users.filter((u) => u.role).sort((a, b) => (a.role === b.role ? (a.name ?? "").localeCompare(b.name ?? "") : a.role === "admin" ? -1 : 1));
  const safeAdmins = staff.filter((u) => u.role === "admin" && u.mfa && !u.banned).length;

  async function add(e: FormEvent) {
    e.preventDefault();
    setAdding(true);
    if (await onAdd(email, role)) setEmail("");
    setAdding(false);
  }

  return (
    <div className="space-y-4">
      {safeAdmins < 2 && (
        <div role="status" className="card flex gap-3 border-amber-300/50">
          <Warning size={24} weight="duotone" className="mt-0.5 shrink-0 text-amber-300" aria-hidden />
          <p className="text-sm text-white/85">
            Hay {safeAdmins === 1 ? "un solo administrador" : `${safeAdmins} administradores`} con verificación en dos pasos.
            Agrega al menos uno más de respaldo (idealmente con un correo de la app, no personal) para que el sitio no dependa de una sola cuenta.
          </p>
        </div>
      )}

      <section className="card space-y-2 text-sm text-white/75">
        <p><b className="text-white">Administrador:</b> todo el panel, incluidos usuarios, sesiones, apariencia y este equipo.</p>
        <p><b className="text-white">Moderador:</b> bloquea o desbloquea cuentas y cancela torneos. No ve correos, sesiones ni el registro.</p>
        <p className="text-white/60">Ambos necesitan verificación en dos pasos. Nadie puede cambiar su propio rol, así siempre queda al menos un administrador.</p>
      </section>

      <form onSubmit={add} className="card space-y-3" noValidate>
        <h2 className="flex items-center gap-2 text-lg uppercase"><UserPlus size={20} aria-hidden /> Agregar al equipo</h2>
        <Field label="Correo de la cuenta" htmlFor="staff-email" help="La persona ya debe tener cuenta. Verá el panel la próxima vez que entre.">
          <input id="staff-email" type="email" autoComplete="off" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Rol" htmlFor="staff-role">
          <select id="staff-role" className="input" value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
            <option value="admin">Administrador</option>
            <option value="moderator">Moderador</option>
          </select>
        </Field>
        <button className="btn-secondary w-full" disabled={adding || !email.includes("@")}>{adding ? "Agregando…" : "Agregar"}</button>
      </form>

      <ul className="space-y-3" aria-label="Miembros del equipo">
        {staff.map((u) => {
          const self = u.id === selfId;
          const other: StaffRole = u.role === "admin" ? "moderator" : "admin";
          return (
            <li key={u.id} className="card space-y-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">{u.name ?? "Sin nombre"} {self && <span className="text-white/50">(tú)</span>}</p>
                <p className="break-all text-sm text-white/65">{u.email}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="chip border-neon/50 text-neon">{LABEL[u.role!]}</span>
                  {u.mfa ? <span className="chip">2FA</span> : <span className="chip-live">Sin 2FA</span>}
                  {u.banned && <span className="chip-live">Bloqueado</span>}
                </div>
              </div>
              {self ? (
                <p className="help !mt-0">Tu rol solo lo puede cambiar otro administrador.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <ActionButton className="btn-secondary !min-h-11 text-sm" onAction={() => onSetRole(u, other)} confirm={`¿Cambiar a ${u.name ?? u.email} a ${LABEL[other]}?${other === "moderator" ? " Se cerrarán sus sesiones." : ""}`}>
                    Hacer {LABEL[other].toLowerCase()}
                  </ActionButton>
                  <ActionButton className="btn-danger !min-h-11 text-sm" onAction={() => onSetRole(u, null)} confirm={`¿Quitar a ${u.name ?? u.email} del equipo? Se cerrarán sus sesiones y volverá a ser jugador.`}>
                    Quitar del equipo
                  </ActionButton>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

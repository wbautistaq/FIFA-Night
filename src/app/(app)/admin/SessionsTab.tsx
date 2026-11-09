"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Desktop, DeviceMobile, DeviceTablet, Question, type Icon } from "@phosphor-icons/react";
import { ActionButton, EmptyState, Toggle } from "@/components/ui/primitives";
import { ONLINE_WINDOW_MS, type Device } from "@/lib/device";
import type { AdminSession } from "@/app/actions/admin";
import { formatFullDateTime } from "@/lib/datetime";

const DEVICE_ICON: Record<Device["kind"], Icon> = { phone: DeviceMobile, tablet: DeviceTablet, desktop: Desktop, unknown: Question };

function ago(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} ${d === 1 ? "día" : "días"}`;
}
const when = (iso: string) => formatFullDateTime(iso);

/** Sesiones abiertas agrupadas por usuario, con opción de cerrar un dispositivo concreto o todos. */
export function SessionsTab({ sessions, onRevokeOne, onRevokeAll }: {
  sessions: AdminSession[] | null;
  onRevokeOne: (s: AdminSession) => Promise<void>;
  onRevokeAll: (userId: string, email: string | null) => Promise<void>;
}) {
  const [onlyOnline, setOnlyOnline] = useState(false);
  const groups = useMemo(() => {
    const online = (s: AdminSession) => Date.now() - Date.parse(s.lastActiveAt) < ONLINE_WINDOW_MS;
    const map = new Map<string, { userId: string; email: string | null; name: string | null; sessions: AdminSession[]; online: boolean; last: string }>();
    for (const s of sessions ?? []) {
      if (onlyOnline && !online(s)) continue;
      const g = map.get(s.userId) ?? { userId: s.userId, email: s.email, name: s.name, sessions: [], online: false, last: s.lastActiveAt };
      g.sessions.push(s);
      g.online ||= online(s);
      if (s.lastActiveAt > g.last) g.last = s.lastActiveAt;
      map.set(s.userId, g);
    }
    return [...map.values()].sort((a, b) => Number(b.online) - Number(a.online) || b.last.localeCompare(a.last));
  }, [sessions, onlyOnline]);

  if (sessions === null) {
    return <p className="card text-sm text-white/75">Falta ejecutar la migración 17 (sesiones) en Supabase para ver esta sección.</p>;
  }
  const onlineCount = groups.filter((g) => g.online).length;

  return (
    <div className="space-y-4">
      <div className="card space-y-3 !py-3">
        <p className="text-sm text-white/75">
          <span className="font-display text-lg text-neon">{onlineCount}</span> {onlineCount === 1 ? "usuario en línea" : "usuarios en línea"} (actividad en la última hora) ·{" "}
          <span className="font-display text-lg text-white">{sessions.length}</span> {sessions.length === 1 ? "sesión abierta" : "sesiones abiertas"}
        </p>
        <Toggle id="only-online" label="Solo en línea" checked={onlyOnline} onChange={setOnlyOnline} />
        <p className="help !mt-0">Una sesión sigue abierta hasta cerrar sesión o vencer. «En línea» indica que usó la app en la última hora; los invitados sin cuenta no aparecen aquí.</p>
      </div>

      {groups.length === 0 ? <EmptyState title={onlyOnline ? "Nadie en línea ahora" : "No hay sesiones abiertas"} /> : (
        <ul className="space-y-3">
          {groups.map((g) => (
            <li key={g.userId} className="card space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold text-white">
                    <span className={clsx("h-2.5 w-2.5 shrink-0 rounded-full", g.online ? "bg-neon shadow-[0_0_8px_rgb(var(--accent))]" : "bg-white/25")} aria-hidden />
                    <span className="truncate">{g.name ?? "Sin nombre"}</span>
                    <span className="sr-only">{g.online ? "(en línea)" : "(inactivo)"}</span>
                  </p>
                  <p className="break-all text-sm text-white/65">{g.email}</p>
                </div>
                {g.sessions.length > 1 && !g.sessions.some((s) => s.current) && (
                  <ActionButton className="btn-ghost !min-h-10 shrink-0 text-sm" confirm={`¿Cerrar las ${g.sessions.length} sesiones de ${g.email}?`} onAction={() => onRevokeAll(g.userId, g.email)}>Cerrar todas</ActionButton>
                )}
              </div>
              <ul className="space-y-2">
                {g.sessions.map((s) => {
                  const DeviceIcon = DEVICE_ICON[s.deviceKind];
                  return (
                    <li key={s.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-2.5">
                      <DeviceIcon size={26} weight="duotone" className="shrink-0 text-volt-light" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                          {s.device}
                          {s.current && <span className="chip border-neon/50 text-neon">Este dispositivo</span>}
                          {s.mfa && <span className="chip">2FA</span>}
                        </p>
                        <p className="text-xs text-white/60">Activa {ago(s.lastActiveAt)} · inició {when(s.createdAt)}</p>
                      </div>
                      {!s.current && (
                        <ActionButton className="btn-secondary !min-h-10 shrink-0 !px-3 text-sm" confirm={`¿Cerrar la sesión de ${g.email} en ${s.device}?`} onAction={() => onRevokeOne(s)}>Cerrar</ActionButton>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

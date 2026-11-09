"use client";

import { useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useT } from "@/components/TournamentShell";
import { EmptyState } from "@/components/ui/primitives";
import { markNotificationsRead } from "@/app/actions/social";
import { Bell, CalendarBlank, CheckCircle, Crown, EnvelopeSimple, Fire, GameController, NotePencil, Shuffle, Trophy, type Icon } from "@phosphor-icons/react";

const ICON: Record<string, Icon> = { your_turn: GameController, invitation: EnvelopeSimple, draw_done: Shuffle, match_pending: CalendarBlank, result_reported: NotePencil, result_confirmed: CheckCircle, playoffs_start: Fire, new_leader: Crown, tournament_finished: Trophy };

export default function Notifications() {
  const { notifications, id, refresh } = useT();
  const unread = notifications.filter((n) => !n.read_at).map((n) => n.id);
  useEffect(() => {
    if (unread.length) {
      const t = setTimeout(() => void markNotificationsRead(id, unread).then(refresh), 2500);
      return () => clearTimeout(t);
    }
  }, [unread.join(","), id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-4">
      <h2 className="section-title">Notificaciones</h2>
      {notifications.length === 0 ? <EmptyState icon={Bell} title="Todo tranquilo">Aquí verás sorteos, resultados y cambios de líder.</EmptyState> : (
        <ul className="space-y-2">{notifications.map((n) => {
          const KindIcon = ICON[n.kind] ?? Bell;
          return (
            <li key={n.id} className={`card flex items-start gap-3 !p-3 ${n.read_at ? "opacity-75" : "border-neon/40 shadow-glow-neon"}`}>
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${n.kind === "tournament_finished" || n.kind === "new_leader" ? "bg-amber-300/15 text-amber-300" : "icon-tile"}`} aria-hidden><KindIcon size={22} weight="duotone" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{n.title}{!n.read_at ? <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wider text-neon">Nueva</span> : null}</p>
                {n.body ? <p className="text-sm text-white/75">{n.body}</p> : null}
                <p className="mt-1 text-xs text-white/55">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}</p>
              </div>
            </li>
          );
        })}</ul>
      )}
    </div>
  );
}

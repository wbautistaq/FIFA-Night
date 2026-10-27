import { NextResponse } from "next/server";
import { z } from "zod";
import { getActor } from "@/lib/actor";
import { loadSnapshot } from "@/lib/snapshot";
import type { Viewer } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Torneo inválido" }, { status: 400 });
  try {
    const actor = await getActor(id);
    if (!actor) return NextResponse.json({ error: "Sin acceso al torneo" }, { status: 401 });
    const snapshot = await loadSnapshot(actor.client, id);

    let notifications: unknown[] = [];
    const q = actor.client.from("notifications").select("id,tournament_id,kind,title,body,read_at,created_at").eq("tournament_id", id).order("created_at", { ascending: false }).limit(30);
    const { data } = actor.kind === "user" && actor.userId ? await q.eq("user_id", actor.userId) : actor.participantId ? await q.eq("participant_id", actor.participantId) : { data: [] };
    notifications = data ?? [];

    const viewer: Viewer = { kind: actor.kind, userId: actor.userId, participantId: actor.participantId, isOrganizer: actor.isOrganizer };
    return NextResponse.json({ snapshot, viewer, notifications }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error cargando el torneo" }, { status: 500 });
  }
}

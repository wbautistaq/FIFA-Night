import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HistoryView } from "./HistoryView";
import type { HMatch, HParticipant, HResult, HTournament } from "@/lib/history";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: tournaments } = await supabase.from("tournaments").select("id,name,status,champion_participant_id").in("status", ["in_progress", "finished"]);
  const ids = (tournaments ?? []).map((t) => t.id);
  const empty = { data: [] as never[] };
  const [parts, matches] = ids.length
    ? await Promise.all([
        supabase.from("tournament_participants").select("id,tournament_id,user_id,display_name,avatar_url,avatar_color").in("tournament_id", ids),
        supabase.from("matches").select("id,tournament_id,home_id,away_id,mvp_id").in("tournament_id", ids).eq("status", "finished"),
      ])
    : [empty, empty];
  const matchIds = (matches.data ?? []).map((m) => m.id);
  const results = matchIds.length ? await supabase.from("match_results").select("match_id,home_score,away_score,home_pens,away_pens,fair_play_home,fair_play_away,played_at").in("match_id", matchIds).eq("status", "confirmed") : empty;
  const playedAt = new Map((results.data ?? []).map((r) => [r.match_id, (r as { played_at: string }).played_at]));

  return (
    <HistoryView
      me={auth.user.id}
      tournaments={(tournaments ?? []) as HTournament[]}
      participants={(parts.data ?? []) as HParticipant[]}
      matches={((matches.data ?? []) as Omit<HMatch, "played_at">[]).map((m) => ({ ...m, played_at: playedAt.get(m.id) ?? "" }))}
      results={(results.data ?? []) as HResult[]}
    />
  );
}

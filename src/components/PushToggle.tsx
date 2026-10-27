"use client";

import { useEffect, useState } from "react";
import { BellRinging, BellSlash } from "@phosphor-icons/react";
import { useToast } from "@/components/ui/primitives";
import { savePushSubscription, testPush } from "@/app/actions/live";

type State = "unsupported" | "ios-install" | "denied" | "off" | "on" | "busy";

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

function keyBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Activa los avisos "te toca jugar" en este celular (Web Push). */
export function PushToggle({ tournamentId }: { tournamentId: string }) {
  const toast = useToast();
  const [state, setState] = useState<State>("busy");
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    (async () => {
      if (!vapid || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        // En iPhone, Safari solo permite avisos con la app instalada en la pantalla de inicio
        return setState(isIos() && !isStandalone() ? "ios-install" : "unsupported");
      }
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub && Notification.permission === "granted" ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, [vapid]);

  async function enable() {
    setState("busy");
    try {
      if ((await Notification.requestPermission()) !== "granted") return setState("denied");
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapid!) }));
      const saved = await savePushSubscription(tournamentId, sub.toJSON());
      if (!saved.ok) throw new Error(saved.error);
      setState("on");
      const t = await testPush(tournamentId);
      toast.show("success", t.ok ? "Avisos activados. Te llegó uno de prueba." : "Avisos activados");
    } catch (e) {
      setState("off");
      toast.show("error", e instanceof Error && e.message ? e.message : "No se pudieron activar los avisos");
    }
  }

  if (state === "unsupported") return null;
  return (
    <div className="card flex items-center gap-3 !py-3">
      {state === "on" ? <BellRinging size={26} weight="duotone" className="shrink-0 text-neon" aria-hidden /> : <BellSlash size={26} weight="duotone" className="shrink-0 text-white/60" aria-hidden />}
      <div className="min-w-0 flex-1 text-sm">
        {state === "on" && <p className="font-semibold text-neon">Avisos activados en este celular</p>}
        {state === "off" && <p><b>Avísame cuando me toque</b><span className="block text-white/60">Llega aunque tengas la app cerrada.</span></p>}
        {state === "busy" && <p className="text-white/60">Comprobando avisos…</p>}
        {state === "denied" && <p className="text-white/70">Bloqueaste los avisos. Actívalos en los ajustes del navegador para este sitio.</p>}
        {state === "ios-install" && <p className="text-white/70">En iPhone: toca <b>Compartir → Agregar a inicio</b>, abre FIFA Night desde ahí y activa los avisos.</p>}
      </div>
      {state === "off" && <button className="btn-primary !min-h-11 shrink-0 !px-4 text-sm" onClick={enable}>Activar</button>}
      {toast.node}
    </div>
  );
}

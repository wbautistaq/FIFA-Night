"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/app/actions/social";
import { checkNickname } from "@/app/actions/players";
import { Field } from "@/components/ui/primitives";
import { nicknameSchema, profileInputSchema } from "@/lib/schemas";

const PLATFORMS = [
  ["presencial", "Presencial"],
  ["playstation", "PlayStation"],
  ["xbox", "Xbox"],
  ["pc", "PC"],
] as const;

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ display_name: "", nickname: "", platform: "presencial" as (typeof PLATFORMS)[number][0], gamer_id: "" });
  const [error, setError] = useState("");
  const [nickState, setNickState] = useState<{ value: string; ok: boolean; message: string } | null>(null);
  const nameOk = profileInputSchema.shape.display_name.safeParse(form.display_name).success;
  const nickFormat = nicknameSchema.safeParse(form.nickname);
  const nickOk = nickFormat.success && nickState?.value === form.nickname.trim() && nickState.ok;

  // Comprueba que el apodo esté libre mientras se escribe (con una pequeña espera)
  useEffect(() => {
    const n = form.nickname.trim();
    if (!nicknameSchema.safeParse(n).success) return;
    const t = setTimeout(async () => {
      const r = await checkNickname(n);
      setNickState({ value: n, ok: r.ok && Boolean(r.data?.available), message: r.ok ? (r.data?.available ? "Disponible" : "Ese apodo ya lo usa otra persona") : r.error });
    }, 350);
    return () => clearTimeout(t);
  }, [form.nickname]);

  async function finish() {
    const res = await updateProfile(form);
    if (!res.ok) return setError(res.error);
    document.cookie = "fn_onboarded=1; path=/; max-age=31536000; samesite=lax";
    router.replace("/");
    router.refresh();
  }

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 py-10">
      <p className="text-center text-sm text-white/60" aria-live="polite">Paso {step} de 3</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step}>
        <div className="h-full bg-neon transition-all" style={{ width: `${(step / 3) * 100}%` }} />
      </div>
      <section className="card space-y-4">
        {step === 1 && (
          <>
            <h1 className="text-2xl font-bold">¿Cómo te llamamos?</h1>
            <Field label="Tu nombre" htmlFor="name" error={form.display_name && !nameOk ? "Escribe tu nombre" : undefined}>
              <input id="name" className="input" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} autoComplete="name" />
            </Field>
            <Field label="Apodo" htmlFor="nick" help={nickOk ? "Disponible ✓ Así te encuentran tus amigos para agregarte a sus torneos" : "Único en Copa del Parche: así te encuentran tus amigos para agregarte a sus torneos"}
              error={form.nickname && !nickFormat.success ? nickFormat.error.issues[0]?.message : nickState && nickState.value === form.nickname.trim() && !nickState.ok ? nickState.message : undefined}>
              <input id="nick" className="input" value={form.nickname} maxLength={20} autoCapitalize="off" onChange={(e) => setForm({ ...form, nickname: e.target.value })} />
            </Field>
            <button className="btn-primary w-full" disabled={!nameOk || !nickOk} onClick={() => setStep(2)}>Siguiente</button>
          </>
        )}
        {step === 2 && (
          <>
            <h1 className="text-2xl font-bold">¿Dónde juegas?</h1>
            <fieldset>
              <legend className="label">Plataforma</legend>
              <div className="grid grid-cols-2 gap-2">
                {PLATFORMS.map(([v, l]) => (
                  <button key={v} type="button" aria-pressed={form.platform === v} onClick={() => setForm({ ...form, platform: v })} className={form.platform === v ? "btn bg-volt text-white" : "btn-secondary"}>{l}</button>
                ))}
              </div>
            </fieldset>
            <Field label="Gamertag / PSN ID / EA ID (opcional)" htmlFor="gid">
              <input id="gid" className="input" value={form.gamer_id} onChange={(e) => setForm({ ...form, gamer_id: e.target.value })} />
            </Field>
            <div className="flex gap-2"><button className="btn-ghost" onClick={() => setStep(1)}>Atrás</button><button className="btn-primary flex-1" onClick={() => setStep(3)}>Siguiente</button></div>
          </>
        )}
        {step === 3 && (
          <>
            <h1 className="text-2xl font-bold">¡Todo listo, {form.nickname || form.display_name}!</h1>
            <p className="text-white/70">Crea tu primer torneo o únete con el link que te pasen tus amigos.</p>
            {error ? <p role="alert" className="error-text">{error}</p> : null}
            <div className="flex gap-2"><button className="btn-ghost" onClick={() => setStep(2)}>Atrás</button><button className="btn-primary flex-1" onClick={finish}>Entrar a Copa del Parche</button></div>
          </>
        )}
      </section>
    </main>
  );
}

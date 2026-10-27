"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "@phosphor-icons/react";
import { Field, Spinner } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/browser";

type Step = { kind: "loading" } | { kind: "enroll"; factorId: string; qr: string; secret: string } | { kind: "verify"; factorId: string } | { kind: "error"; text: string };

/**
 * Segundo paso para entrar al panel: código TOTP de una app de autenticación.
 * La primera vez registra la app (QR); después solo pide el código de 6 dígitos.
 */
export function MfaGate() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const mfa = createClient().auth.mfa;
      const { data, error } = await mfa.listFactors();
      if (error) return setStep({ kind: "error", text: "No se pudo consultar la verificación en dos pasos." });
      const verified = data.totp.find((f) => f.status === "verified");
      if (verified) return setStep({ kind: "verify", factorId: verified.id });
      // Un registro a medias (QR generado pero nunca confirmado) bloquearía uno nuevo
      for (const f of data.all.filter((f) => f.status === "unverified")) await mfa.unenroll({ factorId: f.id });
      const enrolled = await mfa.enroll({ factorType: "totp", friendlyName: "FIFA Night admin" });
      if (enrolled.error) return setStep({ kind: "error", text: "No se pudo iniciar el registro. Revisa que MFA (TOTP) esté activo en Supabase." });
      setStep({ kind: "enroll", factorId: enrolled.data.id, qr: enrolled.data.totp.qr_code, secret: enrolled.data.totp.secret });
    })();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (step.kind !== "enroll" && step.kind !== "verify") return;
    if (!/^\d{6}$/.test(code)) return setError("Escribe los 6 dígitos");
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: step.factorId, code });
    setBusy(false);
    if (error) {
      setCode("");
      return setError(/invalid|expired/i.test(error.message) ? "Código incorrecto o vencido. Usa el que aparece ahora." : "No se pudo verificar el código.");
    }
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="flex items-center gap-3">
        <ShieldCheck size={32} weight="duotone" className="text-neon" aria-hidden />
        <h1 className="text-3xl uppercase">Administración</h1>
      </div>
      {step.kind === "loading" && <Spinner label="Preparando verificación" />}
      {step.kind === "error" && <p role="alert" className="card text-sm text-rose-200">{step.text}</p>}
      {(step.kind === "enroll" || step.kind === "verify") && (
        <form onSubmit={submit} className="card space-y-4" noValidate>
          {step.kind === "enroll" ? (
            <>
              <h2 className="text-lg uppercase">Activa la verificación en dos pasos</h2>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-white/75">
                <li>Abre Google Authenticator, Microsoft Authenticator o 1Password.</li>
                <li>Escanea este código QR (o copia la clave).</li>
                <li>Escribe el código de 6 dígitos que muestra la app.</li>
              </ol>
              {/* eslint-disable-next-line @next/next/no-img-element -- QR generado como data URL */}
              <img src={step.qr} alt="Código QR para tu app de autenticación" width={200} height={200} className="mx-auto rounded-xl bg-white p-2" />
              <p className="break-all rounded-lg bg-black/30 p-2 text-center font-mono text-xs text-white/70" aria-label="Clave para copiar">{step.secret}</p>
            </>
          ) : (
            <>
              <h2 className="text-lg uppercase">Verificación en dos pasos</h2>
              <p className="help !mt-0">Escribe el código de 6 dígitos de tu app de autenticación.</p>
            </>
          )}
          <Field label="Código" htmlFor="mfa-code" error={error ?? undefined}>
            <input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="input text-center font-mono text-2xl tracking-[0.5em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} autoFocus />
          </Field>
          <button className="btn-primary w-full" disabled={busy || code.length !== 6}>{busy ? "Verificando…" : "Entrar al panel"}</button>
        </form>
      )}
    </div>
  );
}

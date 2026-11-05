"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/browser";
import { Field } from "@/components/ui/primitives";
import { safeInternalPath } from "@/lib/redirect";
import { Eye, EyeSlash, Trophy } from "@phosphor-icons/react";

const emailSchema = z.string().trim().email("Escribe un correo válido");

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  // Paso del código: tras enviar el correo, o directamente si ya tienes un código de un correo anterior
  const [codeStep, setCodeStep] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  // La contraseña no depende del correo: es la vía principal mientras el envío de correos no sea fiable
  const [mode, setMode] = useState<"password" | "email">("password");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const validation = emailSchema.safeParse(email);
  const emailError = touched && !validation.success ? validation.error.issues[0]?.message : undefined;
  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const safeNext = safeInternalPath(next);

  async function magicLink(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!validation.success) return;
    setState("sending");
    const { error } = await createClient().auth.signInWithOtp({ email: validation.data, options: { emailRedirectTo: redirectTo() } });
    if (error) {
      setState("error");
      setMessage(/rate|limit/i.test(error.message)
        ? "Se alcanzó el límite de correos por hora. Si ya te llegó un correo antes, usa su código o su enlace."
        : error.status === 504 || /timeout|deadline/i.test(error.message)
          ? "El servidor de correo tardó demasiado en responder. Revisa tu bandeja (puede haber llegado igual) o inténtalo en un minuto."
          : "No pudimos enviar el correo. Intenta de nuevo.");
    } else {
      setState("sent");
      setCodeStep(true);
    }
  }

  async function passwordLogin(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!validation.success || !password) return;
    setVerifying(true);
    const { error } = await createClient().auth.signInWithPassword({ email: validation.data, password });
    if (error) {
      setVerifying(false);
      setState("error");
      setMessage(/invalid/i.test(error.message) ? "Correo o contraseña incorrectos." : "No pudimos iniciar sesión. Intenta de nuevo.");
      return;
    }
    window.location.assign(safeNext);
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!validation.success || !/^\d{6,8}$/.test(code)) return;
    setVerifying(true);
    const { error } = await createClient().auth.verifyOtp({ email: validation.data, token: code, type: "email" });
    if (error) {
      setVerifying(false);
      setState("error");
      setMessage("El código no es válido o ya caducó. Pide uno nuevo.");
      return;
    }
    // Recarga completa para que el servidor lea la sesión recién creada
    window.location.assign(safeNext);
  }

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 py-10">
      <header className="text-center">
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-3xl border border-volt/50 bg-gradient-to-br from-volt/40 via-fuchsia-600/20 to-blaze/30 shadow-glow" aria-hidden>
          <Trophy size={44} weight="duotone" className="text-neon drop-shadow-[0_0_12px_rgba(46,230,255,.7)]" />
        </span>
        <h1 className="mt-4 text-5xl uppercase leading-none">FIFA <span className="bg-gradient-to-r from-neon via-volt-light to-blaze-light bg-clip-text text-transparent">Night</span></h1>
        <p className="mt-3 text-white/75">Torneos de EA SPORTS FC 27 entre amigos, en un minuto.</p>
      </header>
      <section className="card-glow space-y-4" aria-labelledby="login-title">
        <h2 id="login-title" className="text-lg uppercase">Entrar</h2>
        <div role="tablist" aria-label="Forma de entrar" className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
          {([["password", "Contraseña"], ["email", "Código por correo"]] as const).map(([m, label]) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setState("idle"); }} className={`min-h-10 rounded-lg text-sm font-semibold transition ${mode === m ? "bg-volt/40 text-white" : "text-white/65 hover:text-white"}`}>{label}</button>
          ))}
        </div>
        {mode === "password" ? (
          <form onSubmit={passwordLogin} className="space-y-4" noValidate>
            <Field label="Correo electrónico" htmlFor="pw-email" error={emailError}>
              <input id="pw-email" type="email" inputMode="email" autoComplete="email" className="input" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)} aria-invalid={Boolean(emailError)} />
            </Field>
            <Field label="Contraseña o código de acceso" htmlFor="pw">
              <div className="relative">
                <input id="pw" type={showPassword ? "text" : "password"} autoComplete="current-password" className="input pr-12" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-white/60 hover:text-white" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeSlash size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
                </button>
              </div>
            </Field>
            <button className="btn-primary w-full" disabled={verifying || !password}>{verifying ? "Entrando…" : "Entrar"}</button>
            <p className="help text-center">¿Sin contraseña? Entra con un código por correo y créala en «Mi perfil».</p>
          </form>
        ) : codeStep ? (
          <form onSubmit={verifyCode} className="space-y-4" noValidate>
            {state === "sent" ? (
              <p role="status" className="rounded-xl bg-neon/10 p-3 text-sm text-neon">Te enviamos un correo a <strong>{email}</strong> con un código y un enlace. Usa el que prefieras.</p>
            ) : null}
            <Field label="Correo electrónico" htmlFor="email2" error={emailError}>
              <input id="email2" type="email" inputMode="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)} aria-invalid={Boolean(emailError)} />
            </Field>
            <Field label="Código del correo" htmlFor="code" help="Son los números que aparecen en el correo de FIFA Night.">
              <input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d*" maxLength={8} className="input text-center font-display text-2xl tracking-[.4em]" placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
            </Field>
            <button className="btn-primary w-full" disabled={verifying || code.length < 6}>{verifying ? "Entrando…" : "Entrar con el código"}</button>
            <button type="button" className="btn-ghost w-full !min-h-10 text-sm" onClick={() => { setCodeStep(false); setState("idle"); setCode(""); }}>Pedir otro correo</button>
          </form>
        ) : (
          <form onSubmit={magicLink} className="space-y-4" noValidate>
            <Field label="Correo electrónico" htmlFor="email" error={emailError}>
              <input id="email" name="email" type="email" inputMode="email" autoComplete="email" className="input" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)} aria-invalid={Boolean(emailError)} required />
            </Field>
            <button className="btn-primary w-full" disabled={state === "sending"}>{state === "sending" ? "Enviando…" : "Enviarme el código"}</button>
            <button type="button" className="btn-ghost w-full !min-h-10 text-sm" onClick={() => { setCodeStep(true); setState("idle"); }}>Ya tengo un código</button>
          </form>
        )}
        {state === "error" ? <p role="alert" className="error-text">{message}</p> : null}
      </section>
      <p className="text-center text-sm text-white/60">¿Te invitaron a un torneo? Abre el link o escanea el QR que te compartieron: no necesitas cuenta.</p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

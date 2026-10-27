"use client";

import { useState, type FormEvent } from "react";
import { Eye, EyeSlash, Key } from "@phosphor-icons/react";
import { Field, useToast } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/browser";

/** Crear o cambiar la contraseña para entrar sin depender del correo. */
export function PasswordForm() {
  const toast = useToast();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const tooShort = pw.length > 0 && pw.length < 8;
  const mismatch = pw2.length > 0 && pw !== pw2;

  async function save(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (pw.length < 8 || pw !== pw2) return;
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.show("error", /weak|short|length/i.test(error.message) ? "Usa una contraseña más larga o más difícil." : /same/i.test(error.message) ? "Es igual a la contraseña actual." : "No se pudo guardar la contraseña.");
    setPw("");
    setPw2("");
    setTouched(false);
    toast.show("success", "Contraseña guardada. Ya puedes entrar con correo y contraseña.");
  }

  return (
    <form onSubmit={save} className="card space-y-4" noValidate aria-labelledby="pw-h">
      <div className="flex items-center gap-2">
        <Key size={22} weight="duotone" className="text-neon" aria-hidden />
        <h2 id="pw-h" className="text-lg uppercase">Contraseña</h2>
      </div>
      <p className="help !mt-0">Crea una contraseña para entrar sin esperar correos. Mínimo 8 caracteres.</p>
      <Field label="Nueva contraseña" htmlFor="np" error={touched && tooShort ? "Mínimo 8 caracteres" : undefined}>
        <div className="relative">
          <input id="np" type={show ? "text" : "password"} autoComplete="new-password" className="input pr-12" value={pw} onChange={(e) => setPw(e.target.value)} onBlur={() => setTouched(true)} />
          <button type="button" className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-white/60 hover:text-white" aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={show} onClick={() => setShow(!show)}>
            {show ? <EyeSlash size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
          </button>
        </div>
      </Field>
      <Field label="Repite la contraseña" htmlFor="np2" error={mismatch ? "Las contraseñas no coinciden" : undefined}>
        <input id="np2" type={show ? "text" : "password"} autoComplete="new-password" className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} />
      </Field>
      <button className="btn-secondary w-full" disabled={busy || pw.length < 8 || pw !== pw2}>{busy ? "Guardando…" : "Guardar contraseña"}</button>
      {toast.node}
    </form>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { REPORT_REASONS, type ReportReason } from "@/lib/moderation";

/** Pide motivo y detalle de un reporte. El equipo de la plataforma lo revisa en Admin → Reportes. */
export function ReportDialog({ title, onCancel, onSubmit }: {
  title: string;
  onCancel: () => void;
  onSubmit: (reason: ReportReason, details: string) => Promise<boolean>;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  async function send() {
    if (!reason) return;
    setBusy(true);
    const done = await onSubmit(reason, details);
    setBusy(false);
    if (done) onCancel();
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-labelledby="report-title" className="card w-full max-w-sm space-y-4 !bg-pitch-900" onClick={(e) => e.stopPropagation()}>
        <h2 id="report-title" className="text-lg uppercase">{title}</h2>
        <fieldset className="space-y-1">
          <legend className="label">¿Qué pasa?</legend>
          {(Object.entries(REPORT_REASONS) as [ReportReason, string][]).map(([k, label], i) => (
            <label key={k} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-white/5">
              <input ref={i === 0 ? firstRef : undefined} type="radio" name="report-reason" value={k} checked={reason === k} onChange={() => setReason(k)} className="h-5 w-5 accent-[rgb(var(--accent))]" />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
        <div>
          <label htmlFor="report-details" className="label">Detalles (opcional)</label>
          <textarea id="report-details" rows={2} maxLength={500} className="input py-2" value={details} onChange={(e) => setDetails(e.target.value)} />
        </div>
        <p className="help !mt-0">Tu reporte es privado: solo lo ve el equipo de la plataforma.</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
          <button type="button" className="btn-primary" disabled={!reason || busy} onClick={send}>{busy ? "Enviando…" : "Enviar reporte"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

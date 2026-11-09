/** Motivos para reportar contenido o a un jugador. */
export const REPORT_REASONS = {
  spam: "Spam o publicidad",
  ofensivo: "Lenguaje ofensivo u odio",
  acoso: "Acoso o amenazas",
  inapropiado: "Contenido sexual o violento",
  suplantacion: "Se hace pasar por otra persona",
  otro: "Otro motivo",
} as const;

export type ReportReason = keyof typeof REPORT_REASONS;

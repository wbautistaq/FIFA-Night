import { formatDateTime } from "@/lib/datetime";

/** Fecha y hora de Colombia en formato de 12 horas. */
export function LocalDateTime({ iso }: { iso: string }) {
  return <time dateTime={iso}>{formatDateTime(iso)}</time>;
}

/**
 * Misma normalización que la función norm_name de la base: sin tildes, sin mayúsculas, sin espacios repetidos.
 * "Beto", "BETO", "Betó" y " beto " son la misma persona.
 */
export function normName(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Nombre público de un jugador: su apodo si lo tiene; si no, su nombre. */
export function playerName(p: { nickname?: string | null; display_name: string }): string {
  return p.nickname?.trim() || p.display_name;
}

/**
 * Misma normalización que la función norm_name de la base: sin tildes, sin mayúsculas, sin espacios repetidos.
 * "Beto", "BETO", "Betó" y " beto " son la misma persona.
 */
export function normName(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().replace(/\s+/g, " ").toLowerCase();
}

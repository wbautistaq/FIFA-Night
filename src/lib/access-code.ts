import { randomInt } from "node:crypto";

// Sin caracteres ambiguos (0/O, 1/I/L) para dictarlo o copiarlo sin errores
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const block = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

/** Código de acceso de un solo uso para entrar con contraseña (≈ 59 bits de entropía). */
export const newAccessCode = () => `FN-${block()}-${block()}-${block()}`;

// Genera un código de acceso (contraseña) para entrar sin depender del correo.
// Uso: npm run acceso -- correo@ejemplo.com
// Si el correo no tiene cuenta, la crea ya confirmada. El código solo se muestra aquí, una vez.
// Requiere SUPABASE_SERVICE_ROLE_KEY en .env.local: ejecútalo solo en tu propio equipo.
import { randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("Uso: npm run acceso -- correo@ejemplo.com");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

// Sin caracteres ambiguos (0/O, 1/I/L) para dictarlo o copiarlo sin errores
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const block = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
const code = `FN-${block()}-${block()}-${block()}`;

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUser() {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (user || data.users.length < 200) return user ?? null;
  }
  return null;
}

try {
  const user = await findUser();
  if (user) {
    const { error } = await admin.auth.admin.updateUserById(user.id, { password: code });
    if (error) throw error;
  } else {
    const { error } = await admin.auth.admin.createUser({ email, password: code, email_confirm: true });
    if (error) throw error;
  }
  console.log(`\n${user ? "Código de acceso actualizado" : "Cuenta creada"} para ${email}\n`);
  console.log(`   Código de acceso:  ${code}\n`);
  console.log("Entra en la app con «Contraseña», usando tu correo y este código.");
  console.log("Luego puedes cambiarlo por una contraseña propia en «Mi perfil».\n");
} catch (e) {
  console.error("No se pudo generar el código:", e instanceof Error ? e.message : e);
  process.exit(1);
}

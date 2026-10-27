// Da (o quita) el rol de administrador de la plataforma a una cuenta existente.
// Uso: npm run admin -- correo@ejemplo.com          (activar)
//      npm run admin -- correo@ejemplo.com --quitar (desactivar)
// El rol se guarda en app_metadata, que solo puede cambiar la clave de servicio.
// Después hay que cerrar sesión y volver a entrar para que el rol llegue a la sesión.
import { createClient } from "@supabase/supabase-js";

const email = (process.argv[2] ?? "").trim().toLowerCase();
const remove = process.argv.includes("--quitar");
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("Uso: npm run admin -- correo@ejemplo.com [--quitar]");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

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
  if (!user) {
    console.error(`No existe ninguna cuenta con ${email}. Entra primero en la app con ese correo.`);
    process.exit(1);
  }
  const rest = { ...user.app_metadata };
  delete rest.role;
  const { error } = await admin.auth.admin.updateUserById(user.id, { app_metadata: remove ? { ...rest, role: null } : { ...rest, role: "admin" } });
  if (error) throw error;
  console.log(`\n${remove ? "Rol de administrador quitado a" : "Ahora es administrador:"} ${email}\n`);
  if (!remove) {
    console.log("1. Cierra sesión en la app y vuelve a entrar.");
    console.log("2. Ve a Mi perfil → Administración.");
    console.log("3. La primera vez, escanea el QR con Google Authenticator (u otra app) y escribe el código.\n");
  }
} catch (e) {
  console.error("No se pudo cambiar el rol:", e instanceof Error ? e.message : e);
  process.exit(1);
}

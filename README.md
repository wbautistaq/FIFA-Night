# FIFA Night 🏆⚽

PWA mobile-first para organizar torneos privados de FIFA / EA SPORTS FC entre amigos: invitaciones por link/QR, sorteo de equipos con animación, fixtures automáticos (liga, ida y vuelta, copa, doble eliminación, grupos + playoffs, amistosos), resultados con confirmación del rival, tabla y bracket en tiempo real, estadísticas, historial cara a cara, muro, predicciones, FIFA Points, logros y Modo TV.

## Stack

Next.js 15 (App Router) · TypeScript estricto · Tailwind CSS · Supabase (PostgreSQL, Auth, RLS, Realtime, Storage) · Zod · TanStack Query · date-fns · Vitest · Playwright · despliegue en Vercel.

## Requisitos

- Node.js 20+ (probado con 22) y npm
- Un proyecto de Supabase (nube) **o** la [CLI de Supabase](https://supabase.com/docs/guides/cli) con Docker para correrlo en local

## Configuración de Supabase

### Opción A — Supabase local (CLI + Docker)
```bash
supabase start          # aplica supabase/migrations/* y supabase/seed.sql automáticamente
supabase status         # copia API URL, anon key y service_role key
```

### Opción B — Proyecto en la nube
1. Crea el proyecto en supabase.com.
2. Aplica las migraciones en orden (`supabase db push` con la CLI enlazada, o pega cada archivo de `supabase/migrations/` en el SQL Editor).
3. Ejecuta `supabase/seed.sql` (82 equipos ficticios/genéricos).
4. **Authentication → URL Configuration**: Site URL = tu URL pública; Redirect URLs = `https://TU-DOMINIO/auth/callback` y `http://localhost:3000/auth/callback`.
5. **Authentication → Providers**: Email (magic link) viene activo; Google es opcional (configura Client ID/Secret).
6. El bucket `fifa-night` (avatares y fotos del muro, 2 MB, JPG/PNG/WebP) se crea en la migración 3; si Storage no está disponible la app usa avatares con iniciales.

> Torneo demo opcional: `psql "$DATABASE_URL" -v owner_email=tu@correo.com -f supabase/demo.sql` (tras iniciar sesión una vez).

## Variables de entorno

Copia `.env.example` a `.env.local`:

| Variable | Dónde | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | cliente/servidor | URL del proyecto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente/servidor | clave anónima (protegida por RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | **solo servidor** | unirse por token y acciones de invitados (se valida token/cookie antes de cada uso) |
| `NEXT_PUBLIC_SITE_URL` | cliente | URL pública (links de invitación y OAuth) |

Nunca subas `.env.local` ni la service role key al repositorio.

## Desarrollo

```bash
npm install
cp .env.example .env.local   # y completa los valores
npm run dev                  # http://localhost:3000
```

## Pruebas, lint y build

```bash
npm run lint
npm run typecheck
npm run test                 # unitarias (motor de fixtures, sorteo, tabla, historial)
npm run build
npm run test:e2e             # Playwright (smoke sin backend; flujo completo si defines E2E_*)
npm run db:test              # migraciones + seed + RLS en un Postgres local (ver abajo)
```

### Pruebas de base de datos (Postgres real)
`tests/db/flow.test.ts` ejecuta el motor TypeScript contra las funciones y triggers SQL reales (liga, copa con byes, doble eliminación, grupos + playoffs, RLS). Se activa con `DATABASE_URL`:
```bash
PGHOST=localhost PGUSER=postgres bash supabase/tests/run.sh      # crea BD fifa_night_test con stubs de Supabase
DATABASE_URL=postgres://postgres:postgres@localhost:5432/fifa_night_test npx vitest run tests/db
```

### Pruebas E2E
- `tests/e2e/smoke.spec.ts` no necesita backend (rutas protegidas, validación, PWA, offline, accesibilidad básica).
- `tests/e2e/main-flow.spec.ts` recorre el flujo completo (crear → invitar → sortear → fixtures → resultados → tabla → estadísticas → historial → TV) y requiere un Supabase real:
```bash
E2E_SUPABASE_URL=http://127.0.0.1:54321 E2E_SUPABASE_ANON_KEY=... E2E_SUPABASE_SERVICE_ROLE_KEY=... \
  npm run build && npm run test:e2e
```

## Despliegue en Vercel
1. Importa el repo en Vercel (framework: Next.js, sin configuración extra).
2. Define las 4 variables de entorno de arriba (la service role solo en *Production/Preview*, nunca con prefijo `NEXT_PUBLIC_`).
3. Actualiza *Site URL* y *Redirect URLs* en Supabase con el dominio de Vercel.
4. Despliega. La PWA se instala desde el navegador (Añadir a pantalla de inicio).

## Estructura
```
src/lib/engine/   motor puro: fixtures, sorteo, tabla, puntos (100 % testeado)
src/app/          rutas (App Router) + acciones de servidor (src/app/actions)
src/components/   UI reutilizable (shell del torneo, bracket, tabla, sorteo animado…)
supabase/         migraciones SQL, RLS, seed, demo y pruebas SQL
tests/            unit, db y e2e
```
Más detalle en `DECISIONS.md` e `IMPLEMENTATION_REPORT.md`.

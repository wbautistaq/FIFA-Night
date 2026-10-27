# Informe de implementación — FIFA Night

## Estado de verificación (ejecutado en el entorno de desarrollo)

| Verificación | Resultado |
|---|---|
| `npm install` | ✅ |
| `npm run lint` (0 warnings) | ✅ |
| `npm run typecheck` | ✅ |
| `npm run test` (unitarias) | ✅ 34 pasan (motor de fixtures, sorteo, tabla, puntos, historial) |
| Pruebas con Postgres 16 real (`tests/db`, 10 casos) | ✅ liga, copa con byes, penales, corrección bloqueada, doble eliminación (8 y 5 jugadores), grupos + playoffs, RLS de reporte/confirmación y aislamiento entre usuarios |
| Migraciones + seed + cobertura RLS (`supabase/tests`) | ✅ 5 migraciones aplican limpias; 82 equipos; todas las tablas con RLS y políticas |
| `npm run build` | ✅ |
| E2E smoke Playwright (móvil + escritorio, 14 casos) | ✅ rutas protegidas, validación de formulario, manifest/íconos, service worker, offline, accesibilidad básica |
| **E2E flujo completo** (`main-flow.spec.ts`) | ⚠️ **escrito pero NO ejecutado**: requiere un Supabase real (Auth + PostgREST + Realtime) y el entorno de desarrollo no tenía Docker ni acceso a un proyecto. Se omite sin variables `E2E_*`. |

**Lo que no pude verificar**: la integración Next.js ↔ Supabase en vivo (login por magic link/Google, PostgREST con JWT reales, Realtime, Storage, cookie de invitado en un navegador). La lógica de base de datos sí se probó contra Postgres real simulando `auth.uid()`/roles, y la UI compila y arranca, pero el recorrido completo en navegador con backend real debe ejecutarse una vez antes de dar por cerrado el proyecto (ver «Cómo probar»).

## Funcionalidades implementadas
- Auth con magic link y Google (opcional), onboarding en 3 pasos, perfil editable con avatar (Storage) o iniciales.
- Torneos: crear, editar antes del sorteo, duplicar, eliminar borrador, cancelar; listados «Mis torneos» e invitados; estados completos.
- Invitaciones: link único revocable/renovable, QR, copiar, WhatsApp, Telegram; unión sin cuenta; agregar/quitar/reemplazar participantes; límite y anti-duplicados; coorganizadores.
- Sorteo: banco editable (favoritos/prohibidos/propios), filtros (clubes, selecciones, rating, liga), evitar repetidos, modo equilibrado, animación tipo bolsa, repetir y confirmar/bloquear.
- Formatos: liga, ida y vuelta, copa, doble eliminación, grupos + playoffs, amistosos; descanso por número impar; byes; tercer puesto; penales; clasificados por grupo.
- Resultados: registro oficial, reporte de jugador + confirmación/disputa del rival, resolución del organizador, corrección con confirmación explícita; solo lo confirmado afecta tabla/bracket/estadísticas.
- Tabla en tiempo real con desempates configurables y animación; bracket visual con próximo rival y avance automático.
- Estadísticas por jugador y torneo, historial global y head-to-head (récord, últimos 5, mayor goleada, racha).
- FIFA Points, 8 logros, predicciones con ranking de predictores (activables por torneo).
- Muro con reacciones, imágenes, moderación del organizador y sanitización.
- Modo TV (5 vistas, rotación automática, pantalla completa) con control remoto desde el celular del organizador.
- Notificaciones internas (8 tipos), compartir por WhatsApp/Telegram, PWA instalable con service worker y página offline.

## Archivos principales
- `supabase/migrations/*.sql` — esquema (16 tablas), funciones/triggers, RLS, extras, `tv_state`.
- `src/lib/engine/*` — fixtures, sorteo, tabla, puntos. `src/lib/history.ts` — historial y head-to-head.
- `src/app/actions/*` — mutaciones del servidor (Zod + comprobación de rol). `src/app/api/t/[id]/snapshot` — lectura del torneo.
- `src/components/TournamentShell.tsx`, `BracketView.tsx`, `StandingsTable.tsx`, `DrawStage.tsx`, `MatchRow.tsx`.
- `tests/unit`, `tests/db`, `tests/e2e`.

## Cómo probar la app
1. `supabase start` (o proyecto en la nube con migraciones + seed) y completa `.env.local`.
2. `npm run dev`, entra con tu correo, crea un torneo de liga con 4 jugadores, agrégalos manualmente, sortea y confirma, inicia, registra los 6 resultados y revisa Tabla, Bracket, Estadísticas, Historial y Modo TV.
3. Abre el link de invitación en una ventana privada para probar el flujo de invitado (unirse, ver torneo, reportar si está habilitado).
4. Para automatizar el paso 2: `E2E_SUPABASE_*=… npm run build && npm run test:e2e`.

## Limitaciones conocidas
- El E2E de flujo completo no se ha ejecutado (ver arriba).
- Ida y vuelta solo en ligas/grupos; las eliminatorias son partido único. Doble eliminación sin «bracket reset».
- En playoffs de grupos no se evita el cruce de dos jugadores del mismo grupo en primera ronda.
- Invitados: sin Realtime (sondeo cada 5 s), sin subir imágenes al muro y sin historial global entre torneos (no tienen cuenta); su identidad entre torneos se infiere por nombre.
- Remontadas y tarjetas (fair play) las informa el organizador; no hay integración con EA.
- Hay una pequeña ventana de carrera si dos organizadores guardan el mismo resultado a la vez (el índice único lo rechaza y se muestra el error).
- No hay push notifications ni emails transaccionales (fuera de alcance).

## Próximos pasos recomendados
1. Ejecutar el E2E completo contra Supabase local y corregir lo que aparezca.
2. Regenerar tipos con `supabase gen types` y reemplazar `src/lib/types.ts` manual.
3. Bracket reset en doble eliminación e ida y vuelta en eliminatorias.
4. Evitar cruces del mismo grupo en playoffs.
5. Paginación del muro y del historial para torneos muy grandes.

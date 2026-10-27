# Decisiones técnicas y de producto

Tomadas sin consulta, según el brief. Cada una busca lo más simple, seguro y útil para un grupo de amigos.

## Producto
- **Organizador = jugador**: al crear un torneo, el creador entra como participante con rol `coorganizer` para poder jugar y administrar.
- **Estados**: el torneo nace en `registration` (crear → invitar en <60 s). `draft` existe y se alcanza con «Volver a borrador» (permite eliminar); `draw` se alcanza al confirmar el sorteo; `in_progress` al iniciar.
- **Invitados sin cuenta**: se unen con un token (18 bytes aleatorios, único, revocable, renovable). Reciben una cookie httpOnly con un `guest_token` de 24 bytes por torneo. No hay perfil global para invitados.
- **Identidad en el historial global**: `user_id` si hay cuenta; si no, el nombre normalizado (minúsculas, sin espacios extremos). Así un amigo que entra siempre como «Beto» se agrega entre torneos.
- **Desempates**: configurables (por defecto puntos → DG → GF → resultado directo → alfabético). Resultado directo = puntos obtenidos entre los jugadores empatados a puntos del mismo grupo. Mismo criterio en SQL y TS (hay prueba de paridad).
- **Eliminatorias**: partido único; un empate exige penales (si no se envían, la base rechaza el resultado).
- **Doble eliminación**: bracket de ganadores + perdedores + gran final única (sin «bracket reset»). Tamaño al siguiente 2^k con byes resueltos por `resolve_byes`.
- **Grupos + playoffs**: grupos por serpentina; clasificados ordenados por posición → puntos → DG → GF; cruces con la siembra estándar (1 vs último). No se evita el cruce de equipos del mismo grupo en primera ronda.
- **Ida y vuelta**: aplica a liga (y no a eliminatorias, que son partido único).
- **FIFA Points** (constantes en `scoring.ts` y SQL): victoria 3, empate 1, gol 1, valla invicta 2, remontada 2, ganar con equipo de menor rating 2, tanda de penales ganada +1 / perdida +1, MVP 3, título 10.
- **Remontada y fair play** los declara el organizador al registrar (no hay datos de EA): `comeback_by` y puntos de tarjetas.
- **Predicciones**: ganador (o empate) 3 pts, marcador exacto +2 (opcional). Los jugadores no pueden predecir sus propios partidos.
- **Equipos**: 82 equipos ficticios/genéricos (clubes inventados y selecciones por país) con escudo generado por CSS a partir de siglas y colores. Sin assets con copyright.
- **Notificaciones internas** generadas por funciones SQL (sorteo, calendario, resultado reportado/confirmado, nuevo líder, inicio de fase final, fin de torneo). La invitación como evento se cubre con el link/QR.

## Arquitectura
- **Lógica crítica en PostgreSQL** (funciones `SECURITY DEFINER` + triggers): standings, avance de bracket, estadísticas, logros, predicciones, cierre de torneo. Así ningún cliente puede saltarse las reglas y el cálculo es único.
- **Motor TypeScript puro** (`src/lib/engine`) para generar fixtures y sortear: determinista con RNG inyectable, testeable sin base de datos. El resultado se persiste con el RPC atómico `start_tournament`.
- **Invitados y servicio**: Supabase RLS se apoya en `auth.uid()`, que los invitados no tienen. Sus lecturas/acciones pasan por rutas/acciones de servidor que validan la cookie contra `guest_token` y usan la service role; cada acción vuelve a comprobar que el jugador participa en el partido, que el reporte está habilitado, etc. La service role nunca llega al cliente.
- **Tiempo real**: usuarios con cuenta reciben Realtime (invalidación de TanStack Query); invitados usan sondeo cada 5 s (Realtime respeta RLS y no tienen sesión).
- **Un único endpoint de lectura** (`/api/t/[id]/snapshot`) alimenta todas las pantallas del torneo (RLS para usuarios, token validado para invitados).
- **Modo TV remoto**: el estado de la TV vive en `tournaments.tv_state`; el celular del organizador lo cambia y la TV lo recibe por Realtime/sondeo.
- **Service worker**: solo cachea el shell estático y muestra `/offline`; nunca cachea datos de torneos para no servir resultados viejos.
- **Sin next/font/google**: tipografía del sistema (Inter si está instalada) para no depender de la red en el build.
- **Playwright fijado a 1.56.1** para coincidir con el Chromium disponible en el entorno de desarrollo.

## Seguridad
- RLS en las 16 tablas, verificado por `supabase/tests/10_rls_coverage.sql`.
- Funciones internas revocadas a `anon`/`authenticated`; solo RPC explícitos son ejecutables.
- Triggers de guardia: un jugador solo puede reportar sus partidos, el rival solo confirma/disputa sin cambiar el marcador, la configuración se bloquea al iniciar, los estados solo cambian por rutas válidas.
- Todo input pasa por Zod; texto del muro sanitizado (sin HTML/control) y URLs de imagen restringidas al Storage del proyecto; el parámetro `next` del callback solo admite rutas internas.

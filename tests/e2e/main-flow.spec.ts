import { createClient } from "@supabase/supabase-js";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * E2E del flujo principal contra un Supabase REAL (local con `supabase start` o un proyecto de pruebas).
 * Se omite si no hay variables E2E_SUPABASE_*. Ver README → "Pruebas E2E".
 */
const URL = process.env.E2E_SUPABASE_URL;
const ANON = process.env.E2E_SUPABASE_ANON_KEY;
const SERVICE = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
test.skip(!URL || !ANON || !SERVICE, "Define E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY y E2E_SUPABASE_SERVICE_ROLE_KEY");

async function loginAs(context: BrowserContext, email: string) {
  const admin = createClient(URL as string, SERVICE as string, { auth: { persistSession: false } });
  const password = `Pw-${crypto.randomUUID()}`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Organizador E2E" } });
  if (created.error) throw created.error;
  const anon = createClient(URL as string, ANON as string, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw error ?? new Error("Sin sesión");
  const value = "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url");
  const name = `sb-${new globalThis.URL(URL as string).hostname.split(".")[0]}-auth-token`;
  const chunks = value.match(/.{1,3180}/g) ?? [value];
  const cookies = (chunks.length === 1 ? [{ name, value }] : chunks.map((v, i) => ({ name: `${name}.${i}`, value: v }))).map((c) => ({ ...c, url: "http://localhost:" + (process.env.E2E_PORT ?? 3100) }));
  await context.addCookies(cookies);
  await context.addCookies([{ name: "fn_onboarded", value: "1", url: "http://localhost:" + (process.env.E2E_PORT ?? 3100) }]);
}

async function registerResult(page: Page, home: number, away: number) {
  await page.getByLabel(/^Sumar gol a/).first().click({ clickCount: home });
  await page.getByLabel(/^Sumar gol a/).nth(1).click({ clickCount: away });
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /Guardar resultado/ }).click();
  await expect(page.getByText("Resultado final")).toBeVisible();
}

test("flujo completo: crear → invitar → sortear → fixtures → resultados → tabla → estadísticas → TV", async ({ page, context }) => {
  await loginAs(context, `e2e-${Date.now()}@example.com`);

  // 1. Crear torneo
  await page.goto("/torneos/nuevo");
  await page.getByLabel("Nombre del torneo").fill("Copa E2E");
  await page.getByRole("button", { name: "Crear torneo" }).click();
  await expect(page).toHaveURL(/\/t\/[0-9a-f-]+\/invitar/);

  // 2. Invitar: link visible + 3 jugadores manuales
  await expect(page.getByLabel("Link de invitación")).toHaveValue(/\/unirse\//);
  for (const name of ["Ana", "Beto", "Carla"]) {
    await page.getByLabel("Nombre", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Agregar", exact: true }).click();
    await expect(page.getByText(name).first()).toBeVisible();
  }
  const tournamentUrl = page.url().replace("/invitar", "");

  // 3. Sorteo
  await page.goto(`${tournamentUrl}/sorteo`);
  await page.getByRole("button", { name: /Sortear/ }).click();
  await expect(page.getByRole("button", { name: "Confirmar sorteo" })).toBeVisible({ timeout: 20_000 });
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Confirmar sorteo" }).click();
  await expect(page.getByText("Equipos asignados")).toBeVisible();

  // 4. Iniciar y generar fixtures
  await page.goto(tournamentUrl);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Iniciar" }).click();
  await page.goto(`${tournamentUrl}/calendario`);
  await expect(page.getByRole("link", { name: "Abrir partido" })).toHaveCount(6);

  // 5. Resultados de los 6 partidos (liga de 4)
  const scores: Array<[number, number]> = [[3, 0], [2, 2], [1, 0], [4, 1], [0, 0], [2, 1]];
  for (const [h, a] of scores) {
    await page.goto(`${tournamentUrl}/calendario`);
    await page.getByRole("tab", { name: "Pendientes" }).click();
    await page.getByRole("link", { name: "Abrir partido" }).first().click();
    await registerResult(page, h, a);
  }

  // 6. Tabla actualizada y torneo finalizado
  await page.goto(`${tournamentUrl}/tabla`);
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(4);
  await expect(rows.first().locator("td").nth(1)).not.toBeEmpty();
  await page.goto(tournamentUrl);
  await expect(page.getByLabel("Campeón")).toBeVisible();

  // 7. Estadísticas, historial y modo TV
  await page.goto(`${tournamentUrl}/estadisticas`);
  await expect(page.getByRole("table", { name: "Estadísticas por jugador" })).toBeVisible();
  await page.goto("/historial");
  await expect(page.getByRole("heading", { name: "Historial entre amigos" })).toBeVisible();
  await page.goto(`${tournamentUrl}/tv`);
  await expect(page.getByRole("button", { name: "Pantalla completa" })).toBeVisible();
});

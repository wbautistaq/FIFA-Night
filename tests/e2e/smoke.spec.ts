import { expect, test } from "@playwright/test";

// Pruebas que no necesitan Supabase: validan el shell de la app, PWA, rutas protegidas y validaciones de formulario.

test("redirige a /login si no hay sesión", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login\?next=%2F/);
  await expect(page.getByRole("heading", { name: /FIFA\s*Night/ })).toBeVisible();
});

test("login valida el correo en tiempo real", async ({ page }) => {
  await page.goto("/login");
  const email = page.getByLabel("Correo electrónico");
  await email.fill("no-es-correo");
  await email.blur();
  await expect(page.getByText("Escribe un correo válido")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviarme el enlace" })).toBeVisible();
});

test("manifest PWA válido con íconos", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBeTruthy();
  const m = await res.json();
  expect(m).toMatchObject({ name: "Copa Parche", display: "standalone", lang: "es" });
  expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  for (const icon of m.icons) expect((await request.get(icon.src)).ok()).toBeTruthy();
});

test("service worker disponible y página offline", async ({ page, request }) => {
  const sw = await request.get("/sw.js");
  expect(sw.ok()).toBeTruthy();
  expect(await sw.text()).toContain("fifa-night");
  await page.goto("/offline");
  await expect(page.getByRole("heading", { name: "Sin conexión" })).toBeVisible();
});

test("invitación con link malformado muestra error claro", async ({ page }) => {
  await page.goto("/unirse/zzz");
  await expect(page.getByRole("heading", { name: "Invitación no válida" })).toBeVisible();
});

test("API del torneo exige acceso", async ({ request }) => {
  const bad = await request.get("/api/t/no-es-uuid/snapshot");
  expect(bad.status()).toBe(400);
});

test("layout accesible: enlace para saltar al contenido y sin scroll horizontal", async ({ page }) => {
  await page.goto("/login");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Saltar al contenido" })).toBeFocused();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

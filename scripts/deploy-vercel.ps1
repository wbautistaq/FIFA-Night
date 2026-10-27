# Publica FIFA Night en Vercel desde tu PC.
# Uso (PowerShell, en la carpeta del proyecto):
#   powershell -ExecutionPolicy Bypass -File scripts\deploy-vercel.ps1
# 1) Inicia sesión en Vercel (se abre el navegador), 2) crea/enlaza el proyecto,
# 3) copia las claves de Supabase desde .env.local a Vercel (no se muestran en pantalla), 4) publica en producción.

$ErrorActionPreference = "Stop"
$vercel = "vercel@65.4.0"
$keys = @("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY")

if (-not (Test-Path ".env.local")) { Write-Host "No encuentro .env.local en esta carpeta." -ForegroundColor Red; exit 1 }

# Lee KEY=VALOR de .env.local (ignora comentarios y líneas vacías)
$envs = @{}
foreach ($line in Get-Content ".env.local") {
  if ($line -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$') { $envs[$Matches[1]] = $Matches[2] }
}
foreach ($k in $keys) {
  if (-not $envs[$k]) { Write-Host "Falta $k en .env.local" -ForegroundColor Red; exit 1 }
}

Write-Host "`n1/4  Inicia sesión en Vercel (se abrirá el navegador)..." -ForegroundColor Cyan
npx.cmd --yes $vercel login
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n2/4  Creando o enlazando el proyecto 'fifa-night'..." -ForegroundColor Cyan
npx.cmd --yes $vercel link --yes --project fifa-night
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n3/4  Copiando las claves de Supabase a Vercel (producción)..." -ForegroundColor Cyan
foreach ($k in $keys) {
  # Si ya existía, se reemplaza
  npx.cmd --yes $vercel env rm $k production --yes 2>$null | Out-Null
  $envs[$k] | npx.cmd --yes $vercel env add $k production | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Host "No se pudo guardar $k" -ForegroundColor Red; exit 1 }
  Write-Host "   $k guardada"
}

Write-Host "`n4/4  Publicando en producción (tarda 2-3 minutos)..." -ForegroundColor Cyan
npx.cmd --yes $vercel deploy --prod --yes
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nListo. Copia la URL 'Production' de arriba (https://...vercel.app)." -ForegroundColor Green
Write-Host "Después, en Supabase -> Authentication -> URL Configuration:"
Write-Host "  - Site URL: tu URL https://...vercel.app"
Write-Host "  - Redirect URLs: añade https://TU-URL.vercel.app/**"

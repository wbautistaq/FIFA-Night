# Publica FIFA Night en Vercel desde tu PC.
# Uso (PowerShell, en la carpeta del proyecto):
#   powershell -ExecutionPolicy Bypass -File scripts\deploy-vercel.ps1
# 1) Inicia sesión en Vercel si hace falta, 2) crea/enlaza el proyecto,
# 3) copia las claves de Supabase desde .env.local a Vercel (no se muestran en pantalla), 4) publica en producción.
# Se puede volver a ejecutar sin problema: reutiliza la sesión y reemplaza las claves.

# Windows PowerShell 5.1 trata como error cualquier texto que un programa escriba en stderr,
# así que los fallos se comprueban con $LASTEXITCODE y no con -ErrorAction Stop.
$ErrorActionPreference = "Continue"
$vercel = "vercel@65.4.0"
$keys = @("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY")

if (-not (Test-Path ".env.local")) { Write-Host "No encuentro .env.local en esta carpeta." -ForegroundColor Red; exit 1 }

# Lee KEY=VALOR de .env.local (ignora comentarios y líneas vacías)
$envs = @{}
foreach ($line in Get-Content ".env.local") {
  if ($line -match '^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$') { $envs[$Matches[1]] = $Matches[2].Trim() }
}
foreach ($k in $keys) {
  if (-not $envs[$k]) { Write-Host "Falta $k en .env.local" -ForegroundColor Red; exit 1 }
}

Write-Host "`n1/4  Sesión de Vercel..." -ForegroundColor Cyan
cmd /c "npx --yes $vercel whoami >nul 2>nul"
if ($LASTEXITCODE -ne 0) {
  npx.cmd --yes $vercel login
  if ($LASTEXITCODE -ne 0) { Write-Host "No se pudo iniciar sesión." -ForegroundColor Red; exit 1 }
} else { Write-Host "   Ya tienes la sesión iniciada" }

Write-Host "`n2/4  Proyecto 'fifa-night'..." -ForegroundColor Cyan
cmd /c "npx --yes $vercel link --yes --project fifa-night >nul 2>nul"
if ($LASTEXITCODE -ne 0) { Write-Host "No se pudo enlazar el proyecto." -ForegroundColor Red; exit 1 }
Write-Host "   Proyecto enlazado"

Write-Host "`n3/4  Copiando las claves de Supabase a Vercel (producción)..." -ForegroundColor Cyan
$tmp = [System.IO.Path]::GetTempFileName()
try {
  foreach ($k in $keys) {
    # Si ya existía se reemplaza; si no existía, el aviso se ignora
    cmd /c "npx --yes $vercel env rm $k production --yes >nul 2>nul"
    # El valor va por un archivo temporal sin salto de línea final (así no se cuela un retorno de carro en la clave)
    [System.IO.File]::WriteAllText($tmp, $envs[$k])
    cmd /c "npx --yes $vercel env add $k production < `"$tmp`" >nul 2>nul"
    if ($LASTEXITCODE -ne 0) { Write-Host "No se pudo guardar $k" -ForegroundColor Red; exit 1 }
    Write-Host "   $k guardada"
  }
} finally {
  Remove-Item $tmp -ErrorAction SilentlyContinue
}

Write-Host "`n4/4  Publicando en producción (tarda 2-3 minutos)..." -ForegroundColor Cyan
npx.cmd --yes $vercel deploy --prod --yes
if ($LASTEXITCODE -ne 0) { Write-Host "La publicación falló; revisa el mensaje de arriba." -ForegroundColor Red; exit 1 }

Write-Host "`nListo. Copia la URL 'Production' de arriba (https://...vercel.app)." -ForegroundColor Green
Write-Host "Después, en Supabase -> Authentication -> URL Configuration:"
Write-Host "  - Site URL: tu URL https://...vercel.app"
Write-Host "  - Redirect URLs: añade https://TU-URL.vercel.app/**"

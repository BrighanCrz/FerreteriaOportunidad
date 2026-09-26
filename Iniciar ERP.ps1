$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$runtime = Join-Path $env:LOCALAPPDATA 'FerroERP'
$pgRoot = Join-Path $runtime 'postgresql\pgsql'
$archive = Join-Path $runtime 'postgresql.zip'
$dataDir = Join-Path $runtime 'pgdata'
$pgPort = 55432

if (-not (Test-Path (Join-Path $pgRoot 'bin\postgres.exe'))) {
  if (-not (Test-Path $archive)) {
    New-Item -ItemType Directory -Force $runtime | Out-Null
    Write-Host 'Descargando PostgreSQL 18 oficial...' -ForegroundColor Cyan
    Invoke-WebRequest -Uri 'https://get.enterprisedb.com/postgresql/postgresql-18.6-1-windows-x64-binaries.zip' -OutFile $archive -TimeoutSec 600
  }
  Write-Host 'Preparando PostgreSQL local (solo la primera vez)...' -ForegroundColor Cyan
  Expand-Archive -LiteralPath $archive -DestinationPath (Join-Path $runtime 'postgresql') -Force
}
$bin = Join-Path $pgRoot 'bin'
if (-not (Test-Path (Join-Path $dataDir 'PG_VERSION'))) {
  New-Item -ItemType Directory -Force $dataDir | Out-Null
  & (Join-Path $bin 'initdb.exe') -D $dataDir -U postgres --encoding=UTF8 --auth-local=trust --auth-host=trust
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo inicializar PostgreSQL.' }
}
$listener = Get-NetTCPConnection -LocalPort $pgPort -State Listen -ErrorAction SilentlyContinue
if (-not $listener) {
  Write-Host "Iniciando PostgreSQL en 127.0.0.1:$pgPort..." -ForegroundColor Cyan
  & (Join-Path $bin 'pg_ctl.exe') start -D $dataDir -l (Join-Path $runtime 'postgres.log') -o "-h 127.0.0.1 -p $pgPort" -w
  if ($LASTEXITCODE -ne 0) { throw "PostgreSQL no pudo iniciar. Revisa $(Join-Path $runtime 'postgres.log')." }
}
$dbExists = & (Join-Path $bin 'psql.exe') -h 127.0.0.1 -p $pgPort -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='ferreteria_erp'"
if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar PostgreSQL. Revisa el archivo postgres.log.' }
if ($dbExists -notcontains '1') { & (Join-Path $bin 'createdb.exe') -h 127.0.0.1 -p $pgPort -U postgres ferreteria_erp }
if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear o consultar la base de datos.' }

Write-Host 'Aplicando migraciones y datos iniciales...' -ForegroundColor Cyan
Push-Location $root
try {
  pnpm --dir backend prisma migrate deploy
  if ($LASTEXITCODE -ne 0) { throw 'Falló la migración de la base de datos.' }
  pnpm --dir backend db:seed
  if ($LASTEXITCODE -ne 0) { throw 'Falló la carga de datos iniciales.' }
  pnpm build
  if ($LASTEXITCODE -ne 0) { throw 'Falló la compilación del proyecto.' }
} finally { Pop-Location }

$apiPort = 4000
$apiListener = Get-NetTCPConnection -LocalPort $apiPort -State Listen -ErrorAction SilentlyContinue
if (-not $apiListener) {
  $node = (Get-Command node).Source
  $env:PG_DUMP_PATH = Join-Path $bin 'pg_dump.exe'
  $api = Start-Process -FilePath $node -ArgumentList 'dist\src\server.js' -WorkingDirectory (Join-Path $root 'backend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime 'api.log') -RedirectStandardError (Join-Path $runtime 'api-error.log')
  Set-Content -LiteralPath (Join-Path $runtime 'api.pid') -Value $api.Id
}
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  try { Invoke-RestMethod 'http://127.0.0.1:4000/api/health' | Out-Null; break } catch { Start-Sleep -Seconds 1 }
}
try { Invoke-RestMethod 'http://127.0.0.1:4000/api/health' | Out-Null } catch { throw "La API no inició. Revisa $(Join-Path $runtime 'api-error.log')." }
Write-Host 'ERP listo en http://localhost:4000' -ForegroundColor Green
Start-Process 'http://localhost:4000'

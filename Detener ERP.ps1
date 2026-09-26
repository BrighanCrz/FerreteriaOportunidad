$root = $PSScriptRoot
$runtime = Join-Path $env:LOCALAPPDATA 'FerroERP'
$pidFile = Join-Path $runtime 'api.pid'
if (Test-Path $pidFile) {
  $apiId = [int](Get-Content -LiteralPath $pidFile -Raw)
  Stop-Process -Id $apiId -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}
$pgCtl = Join-Path $runtime 'postgresql\pgsql\bin\pg_ctl.exe'
$dataDir = Join-Path $runtime 'pgdata'
if ((Test-Path $pgCtl) -and (Test-Path (Join-Path $dataDir 'PG_VERSION'))) {
  & $pgCtl stop -D $dataDir -m fast -w | Out-Null
}
Write-Host 'ERP y su base local se detuvieron.' -ForegroundColor Yellow

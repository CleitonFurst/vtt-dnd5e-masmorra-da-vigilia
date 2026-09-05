$dir = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $env:TEMP 'opencode\vtt'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir 'server.log'

while ($true) {
  "[$(Get-Date -Format o)] [watchdog] iniciando servidor" | Add-Content $log
  Push-Location $dir
  try {
    & (Join-Path $dir 'node_modules\.bin\tsx.cmd') apps/server/src/index.ts *>> $log
  } catch {
    "[watchdog] erro: $_" | Add-Content $log
  }
  Pop-Location
  "[$(Get-Date -Format o)] [watchdog] servidor saiu (code $LASTEXITCODE); reiniciando em 2s" | Add-Content $log
  Start-Sleep -Seconds 2
}


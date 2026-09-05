$dir = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $env:TEMP 'opencode\vtt'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir 'web.log'

while ($true) {
  "[$(Get-Date -Format o)] [watchdog] iniciando vite" | Add-Content $log
  Push-Location $dir
  try {
    Push-Location (Join-Path $dir 'apps\web')
    & (Join-Path $dir 'node_modules\.bin\vite.cmd') *>> $log
  } catch {
    "[watchdog] erro: $_" | Add-Content $log
  }
  Pop-Location
  "[$(Get-Date -Format o)] [watchdog] vite saiu (code $LASTEXITCODE); reiniciando em 2s" | Add-Content $log
  Start-Sleep -Seconds 2
}


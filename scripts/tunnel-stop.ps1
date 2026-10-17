# Stops the Cloudflare Tunnel started from this repo's cloudflared/config.yml.
# Does not stop unrelated cloudflared processes.

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Config = Join-Path $Root "cloudflared\config.yml"
$PidFile = Join-Path $Root "cloudflared\tunnel.pid"
$stopped = @()

function Stop-TunnelProcess([int]$ProcessId, [string]$Reason) {
  $proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if (-not $proc) { return }
  if ($proc.ProcessName -ne "cloudflared") {
    Write-Host "Skipping PID $ProcessId ($($proc.ProcessName)); it is not cloudflared."
    return
  }
  Stop-Process -Id $ProcessId -Force
  $script:stopped += $ProcessId
  Write-Host "Stopped cloudflared PID $ProcessId ($Reason)."
}

if (Test-Path $PidFile) {
  $raw = (Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
  $pidFromFile = 0
  if ($raw -and [int]::TryParse($raw.Trim(), [ref]$pidFromFile)) {
    Stop-TunnelProcess -ProcessId $pidFromFile -Reason "pid file"
  }
  Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

$running = Get-CimInstance Win32_Process -Filter "Name = 'cloudflared.exe'" | Where-Object {
  $_.CommandLine -and ($_.CommandLine -like "*$Config*")
}
foreach ($proc in $running) {
  if ($stopped -contains $proc.ProcessId) { continue }
  Stop-TunnelProcess -ProcessId $proc.ProcessId -Reason "command line matches config"
}

if ($stopped.Count -eq 0) {
  Write-Host "No Cloudflare Tunnel is running for $Config"
  exit 0
}

Write-Host "Tunnel stopped."

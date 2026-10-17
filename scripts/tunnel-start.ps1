# Starts the named Cloudflare Tunnel defined in cloudflared/config.yml.
# Foreground by default: Ctrl+C stops it. -Background detaches and writes a pid file.
param(
  [switch]$Background
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Config = Join-Path $Root "cloudflared\config.yml"
$PidFile = Join-Path $Root "cloudflared\tunnel.pid"
$LogFile = Join-Path $Root "cloudflared\tunnel.log"
$ErrFile = Join-Path $Root "cloudflared\tunnel.err.log"

if (-not (Test-Path $Config)) {
  throw "Missing $Config"
}

$rawLines = Get-Content -Path $Config
$activeLines = New-Object System.Collections.Generic.List[string]
foreach ($line in $rawLines) {
  $code = ($line -replace '\s+#.*$', '').Trim()
  if ($code.Length -eq 0 -or $code.StartsWith("#")) { continue }
  $activeLines.Add($code)
}
$active = $activeLines -join "`n"

if ($active -match '(?i)3306|mysql|5432|27017|6379|0\.0\.0\.0|localhost:3000') {
  throw "Refusing to start. cloudflared/config.yml must target only http://127.0.0.1:3000 and must not mention MySQL or other internal ports."
}

$services = New-Object System.Collections.Generic.List[string]
foreach ($line in $activeLines) {
  $rule = $line -replace '^-\s*', ''
  if ($rule -match '^service:\s*(.+)$') {
    $services.Add($Matches[1].Trim().Trim('"').Trim("'"))
  }
}
$allowed = @("http://127.0.0.1:3000", "http_status:404")
foreach ($svc in $services) {
  if ($allowed -notcontains $svc) {
    throw "Refusing to start. Ingress service '$svc' is not allowed. Only http://127.0.0.1:3000 and http_status:404 are permitted."
  }
}
if ($services -notcontains "http://127.0.0.1:3000" -or $services -notcontains "http_status:404") {
  throw "Config must publish http://127.0.0.1:3000 and end with service: http_status:404."
}
if (($activeLines -notcontains "warp-routing:") -or ($activeLines -notcontains "enabled: false")) {
  throw "Refusing to start. warp-routing.enabled must be false so the tunnel cannot reach other local ports."
}
if ($active -match 'REPLACE_WITH_TUNNEL_UUID' -or $active -match 'app\.example\.com') {
  Write-Host "cloudflared/config.yml still has placeholders. Finish one-time setup, then edit the file:"
  Write-Host ""
  Write-Host "  winget install --id Cloudflare.cloudflared"
  Write-Host "  cloudflared tunnel login"
  Write-Host "  cloudflared tunnel create architecture-office"
  Write-Host "  cloudflared tunnel route dns architecture-office app.yourdomain.com"
  Write-Host ""
  Write-Host "Set credentials-file to the JSON path printed by 'tunnel create'."
  Write-Host "Set hostname to the DNS name you routed."
  exit 1
}

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  throw "cloudflared is not on PATH. Install it with: winget install --id Cloudflare.cloudflared"
}

Write-Host "Starting Cloudflare Tunnel for http://127.0.0.1:3000"
Write-Host "Config: $Config"
Write-Host "No other local ports are published."

if ($Background) {
  if (Test-Path $PidFile) {
    $existing = Get-Content $PidFile -ErrorAction SilentlyContinue
    if ($existing -and (Get-Process -Id $existing -ErrorAction SilentlyContinue)) {
      throw "Tunnel already running (PID $existing). Stop it with: npm run tunnel:stop"
    }
  }

  $proc = Start-Process -FilePath "cloudflared" `
    -ArgumentList @("tunnel", "--config", $Config, "run") `
    -PassThru `
    -WindowStyle Hidden `
    -RedirectStandardOutput $LogFile `
    -RedirectStandardError $ErrFile
  $proc.Id | Set-Content -Path $PidFile
  Write-Host "Tunnel running in the background (PID $($proc.Id))."
  Write-Host "Log: $LogFile"
  Write-Host "Stop: npm run tunnel:stop"
  exit 0
}

Write-Host "Foreground mode. Press Ctrl+C in this window to stop the tunnel."
& cloudflared tunnel --config $Config run
exit $LASTEXITCODE

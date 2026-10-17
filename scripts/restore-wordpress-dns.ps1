# Puts https://musthakahammed.com/ back on the Hostinger WordPress site.
# Does not change crm.musthakahammed.com or the local app.
$ErrorActionPreference = "Stop"

$raw = (Get-Content -Raw "$env:USERPROFILE\.cloudflared\cert.pem") -replace '-----BEGIN ARGO TUNNEL TOKEN-----','' -replace '-----END ARGO TUNNEL TOKEN-----','' -replace '\s',''
$cert = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($raw)) | ConvertFrom-Json
$headers = @{ Authorization = "Bearer $($cert.apiToken)"; "Content-Type" = "application/json" }
$base = "https://api.cloudflare.com/client/v4/zones/$($cert.zoneID)/dns_records"

$existing = Invoke-RestMethod -Uri "$base?name=musthakahammed.com" -Headers $headers
foreach ($record in $existing.result) {
  if ($record.type -eq "CNAME" -and $record.content -like "*.cfargotunnel.com") {
    Invoke-RestMethod -Method Delete -Uri "$base/$($record.id)" -Headers $headers | Out-Null
    Write-Host "Removed temporary tunnel CNAME for musthakahammed.com"
  }
}

$wanted = @(
  @{ type = "A"; content = "89.117.157.56" },
  @{ type = "AAAA"; content = "2a02:4780:11:1100:0:2479:599c:d" }
)
$after = Invoke-RestMethod -Uri "$base?name=musthakahammed.com" -Headers $headers
foreach ($item in $wanted) {
  $found = $after.result | Where-Object { $_.type -eq $item.type -and $_.content -eq $item.content }
  if ($found) {
    Write-Host "Already present: $($item.type) $($item.content)"
    continue
  }
  $body = @{
    type = $item.type
    name = "musthakahammed.com"
    content = $item.content
    proxied = $true
    ttl = 1
  } | ConvertTo-Json
  $created = Invoke-RestMethod -Method Post -Uri $base -Headers $headers -Body $body
  if (-not $created.success) { throw "Could not restore $($item.type) record" }
  Write-Host "Restored $($item.type) $($item.content)"
}

Write-Host "WordPress DNS restored. Stop the tunnel with: npm run tunnel:stop"

#!/usr/bin/env bash
# Remove ONLY the office_crm demo. Never touch ArchOffice / acmm.mooo.com.
set -euo pipefail

echo "== remove office_crm only =="
echo "Protected: /var/www/architecture_office  /var/www/archoffice  PM2 architecture_office  acmm.mooo.com"

if pm2 describe architecture_office >/dev/null 2>&1; then
  echo "OK: architecture_office is running — will not stop it"
fi

if pm2 describe office_crm >/dev/null 2>&1; then
  pm2 delete office_crm || true
  pm2 save || true
  echo "Removed PM2 process office_crm"
else
  echo "No PM2 process named office_crm"
fi

for f in /etc/nginx/sites-enabled/office_crm /etc/nginx/sites-available/office_crm; do
  if [ -e "$f" ] || [ -L "$f" ]; then
    rm -f "$f"
    echo "Removed $f"
  fi
done

if command -v nginx >/dev/null 2>&1; then
  nginx -t
  systemctl reload nginx
  echo "Reloaded nginx (other vhosts unchanged)"
fi

if command -v certbot >/dev/null 2>&1; then
  certbot delete --cert-name office-crm.mooo.com --non-interactive || true
fi

if [ -d /var/www/office_crm ]; then
  rm -rf /var/www/office_crm
  echo "Removed /var/www/office_crm"
else
  echo "No /var/www/office_crm directory"
fi

# Isolated demo DB only — skip if mysql is unavailable
mysql --protocol=socket -u root -e "DROP DATABASE IF EXISTS office_crm; DROP USER IF EXISTS 'office_crm'@'localhost'; FLUSH PRIVILEGES;" 2>/dev/null || \
  echo "Skipped MySQL drop (no root socket access or already gone)"

echo "VERIFY acmm still present:"
ls -d /var/www/architecture_office 2>/dev/null || echo "WARN: architecture_office path missing (was already missing)"
pm2 describe architecture_office >/dev/null 2>&1 && echo "OK: PM2 architecture_office still exists"
echo "REMOVE_OK"

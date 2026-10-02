# Remove Office CRM from the VPS

Keeps **https://acmm.mooo.com** and `/var/www/architecture_office`.

On the VPS as root:

```bash
bash /var/www/architecture_office/deploy/remove-office-crm.sh
```

Or from GitHub: **Actions → Remove office_crm from VPS → Run workflow**.

That deletes only: PM2 `office_crm`, Nginx `office_crm`, `/var/www/office_crm`, cert `office-crm.mooo.com`, MySQL `office_crm`.

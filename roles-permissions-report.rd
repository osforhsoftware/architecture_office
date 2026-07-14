# Architecture Office App — Roles & Permissions Report
# Updated: 2026-07-13 — Super Admin / Admin RBAC refactor

================================================================================
1. OVERVIEW
================================================================================

Fixed Role-Based Access Control (RBAC) with a privileged hierarchy:

  Super Admin  >  Admin  >  Staff roles

- Roles are stored on each user in `app_users.role` (VARCHAR).
- Permissions are enforced in application code (not a DB permissions matrix).
- Source of truth: `lib/constants.ts`, `lib/permissions.ts`, `lib/admin-nav.ts`

Role keys recognized by auth / guards:

  SUPER_ADMIN
  ADMIN
  PLANNING_STAFF
  PERMIT_STAFF
  THREED_STAFF
  ESTIMATION_STAFF
  BILLING_STAFF

================================================================================
2. ALL ROLES
================================================================================

| # | Role Name           | Portal          | Home path           | Creatable via UI        |
|---|---------------------|-----------------|---------------------|-------------------------|
| 1 | Super Admin         | /admin          | /admin              | Seed / env / DB only    |
| 2 | Admin               | /admin (limited)| /admin/projects      | Super Admin (Admins UI) |
| 3 | Planning Staff      | /staff          | /staff              | Yes (Staff UI)          |
| 4 | Permit Staff        | /staff          | /staff              | Yes                     |
| 5 | 3D Staff            | /staff          | /staff              | Yes                     |
| 6 | Estimation Staff    | /staff          | /staff              | Yes                     |
| 7 | Billing Staff       | /admin (limited)| /admin/billing      | Yes                     |

================================================================================
3. PERMISSION GUARDS
================================================================================

lib/permissions.ts:

  requireSuperAdmin()         — clients, workflow, billing ops, settings, staff edit/delete
  requireAdminOrSuperAdmin()  — create staff, create project only
  requireBillingAccess()      — billing + invoices (Super Admin, Billing Staff)
  requireStaffAccess()        — staff portal actions

lib/project-access.ts:

  isAdmin(user)  — true for Super Admin OR Admin (office privileges)

================================================================================
4. SIDEBAR NAVIGATION
================================================================================

Super Admin:
  Dashboard, Clients, Projects, Departments, Staff, Admin Management,
  Billing, Invoices, Reports, Notifications, Settings, Security,
  Audit Logs, User Management

Admin:
  Projects, Staff
  (add-only; edit/delete and all other modules require Super Admin)

Billing Staff:
  Billing, Invoices, Billing Projects, Notifications

Staff:
  Unchanged (Home, My Projects, Profile)

================================================================================
5. SUPER ADMIN–ONLY ROUTES (under /admin)
================================================================================

  /admin/admins     — Admin Management
  /admin/users      — User Management
  /admin/security   — Security / role reference
  /admin/audit      — Audit Logs
  /admin/settings   — Company / system settings
  /admin/reports    — Analytics reports

Enforced by page guards + AdminRouteGuard client redirect.

================================================================================
6. DEFAULT CREDENTIALS
================================================================================

No hardcoded privileged passwords in source.

Environment variables (see .env.example):

  SUPER_ADMIN_USERNAME
  SUPER_ADMIN_PASSWORD
  ADMIN_USERNAME
  ADMIN_PASSWORD

Setup:    npm run db:setup
Migrate:  npm run db:migrate-rbac

Migration promotes existing `Admin` rows to `Super Admin`, then upserts
accounts from env. ADMIN_USERNAME must differ from SUPER_ADMIN_USERNAME.

================================================================================
7. AUDIT LOGGING
================================================================================

Table: audit_logs (user_id, role, action, entity_type, entity_id, details, ip_address, created_at)

Logged for Super Admin / Admin (and others where applicable):

  auth.login / auth.logout
  client.*, project.*, staff.*, admin.*, user.set_active
  settings.*, invoice.*, payment.*

UI: /admin/audit (Super Admin only)

================================================================================
8. SECURITY NOTES
================================================================================

- Passwords hashed with bcrypt
- Session cookie ao_session (httpOnly)
- Unauthorized API access returns HTTP 403
- Server-side authorization on all mutations
- Client-side nav filtering + route guards

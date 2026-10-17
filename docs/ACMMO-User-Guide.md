# ACMMO Architects — Office System User Guide

**Architecture / Interiors / Construction**

Complete how-to-use manual for the ACMMO office management website: login, roles, daily work, project workflow, billing, finance, attendance, and settings.

| | |
|---|---|
| **Product** | ACMMO Office Management System |
| **Audience** | Acmmo Admin, Office Admin, Billing Staff, Department Staff |
| **Version** | Current production (September 2026) |
| **Currency** | Indian Rupees (INR) |

---

## Contents

1. [What this system does](#1-what-this-system-does)
2. [How to sign in](#2-how-to-sign-in)
3. [Who can do what](#3-who-can-do-what)
4. [Menus by role](#4-menus-by-role)
5. [Quick start (first day)](#5-quick-start-first-day)
6. [Dashboard](#6-dashboard)
7. [Clients](#7-clients)
8. [Create a project](#8-create-a-project)
9. [Project list](#9-project-list)
10. [Project detail page](#10-project-detail-page)
11. [Full project workflow](#11-full-project-workflow)
12. [Staff portal](#12-staff-portal)
13. [Plinth-level inspection](#13-plinth-level-inspection)
14. [Documents, files, KMAP, drawing numbers](#14-documents-files-kmap-drawing-numbers)
15. [Billing and invoices](#15-billing-and-invoices)
16. [Finance](#16-finance)
17. [Attendance](#17-attendance)
18. [Departments, services, documents, custom fields](#18-departments-services-documents-custom-fields)
19. [Staff, admins, and users](#19-staff-admins-and-users)
20. [Notifications](#20-notifications)
21. [Reports, settings, security, audit](#21-reports-settings-security-audit)
22. [Status dictionary](#22-status-dictionary)
23. [Daily checklists](#23-daily-checklists)
24. [Tips and common questions](#24-tips-and-common-questions)

---

## 1. What this system does

ACMMO Office is the single place to run the architecture office from first client call to handover and payment.

You can:

- Keep a client directory (name, phone, Aadhaar, district, linked projects)
- Create projects with a **full package** or **custom services**
- Move each project through Planning → selected services → Admin Review → Billing → Closed
- Assign work to Planning, Permit, 3D, Estimation, and Billing staff
- Track documents, drawings, floor areas (KMAP), files, and notes
- Record invoices, payments, project income/expense, and office cash
- Mark GPS attendance and submit expense claims
- Print project sheets and invoices with the company name exactly as typed in Settings

**Home pages after login**

| Role | Opens at |
|------|----------|
| Acmmo Admin (Super Admin) | `/admin` Dashboard |
| Admin (office manager) | `/admin/projects` |
| Billing Staff | `/admin/billing` |
| Planning / Permit / 3D / Estimation / other staff | `/staff` |

---

## 2. How to sign in

1. Open the office website.
2. Enter your **username** and **password**.
3. Click **Sign in**.
4. You land on the home page for your role (table above).

**Session**

- You stay signed in for **7 days** (secure cookie).
- Sign out from your profile / account menu when you leave a shared computer.

**If login fails**

- Check Caps Lock and username spelling.
- Ask Acmmo Admin to reset the password (Security / User Management).
- Inactive users cannot sign in.

The login tagline is **Architecture / Interiors / Construction**.

---

## 3. Who can do what

The system uses four kinds of accounts.

### 3.1 Acmmo Admin (also stored as “Super Admin” on older accounts)

Full control of the office:

- Dashboard, clients, projects, departments, services, documents, custom fields
- Staff, attendance reports, admin accounts, billing, invoices, finance
- Reports, notifications, company settings, security, audit logs, user management
- Assign staff, approve or reject work, reassign, move department, override status, close projects
- Edit **closed** projects
- Change Super Admin password from Security

### 3.2 Admin (office manager)

Day-to-day office work, not system setup:

- Clients and projects (create, edit, search, print)
- Project finance and office finance (full)
- **Cannot** assign / approve / reject workflow (view only)
- **Cannot** open Settings, Security, Audit, User Management, Admin Management, Attendance reports, Departments, Services catalog, Staff directory, Billing dashboard, or Reports

Home page is **Projects**.

### 3.3 Billing Staff

Money and billing projects:

- Billing dashboard, invoices, billing-stage projects
- Project and office finance: dashboards, income, expenses, reports
- Notifications
- **Cannot** manage accounts, vendors, salary, cash book, or finance settings

### 3.4 Department staff (Planning, Permit, 3D, Estimation, custom departments)

Work on assigned projects:

- Staff home, My Projects, Attendance, Expenses, Profile
- Start work, mark complete, submit for review, return to office
- Fill checklist, files, KMAP; Planning Staff can edit drawing number in Planning & Design
- **Cannot** see billing amounts or office finance

A person can have **more than one staff role** (for example Planning + Permit). Their queues follow all of those roles.

---

## 4. Menus by role

### Acmmo Admin sidebar

Dashboard · Clients · Projects · Departments · Services · Documents · Custom Fields · Staff · Attendance · Admin Management · Billing · Invoices · Finance (Project + Office) · Reports · Notifications · Settings · Security · Audit Logs · User Management

### Office Admin sidebar

Clients · Projects · Finance (Project + Office)

### Billing Staff sidebar

Billing Dashboard · Invoices · Billing Projects · Finance (limited) · Notifications

### Staff sidebar

Home · My Projects · Attendance · Expenses · Profile

---

## 5. Quick start (first day)

**Office Admin / Acmmo Admin**

1. Confirm the client exists (Clients → New Client), or use **Project + Client**.
2. Create the project and pick **Full Project** or **Custom Services**.
3. Optionally mark **Site visit pending** and/or **Under construction**.
4. Print the project sheet if needed.
5. Acmmo Admin assigns staff on the project page.
6. Staff complete the step and submit for review.
7. Acmmo Admin approves (or rejects for correction).
8. Repeat until **Billing**.
9. Record invoices and payments.
10. When the project is **Paid**, Acmmo Admin **closes** it.

**Staff**

1. Check in on **Attendance** (inside the office GPS area).
2. Open **Home** — pending and in-progress work is first.
3. Open a project → **Start work** → fill documents / files / areas → **Mark work completed** → **Submit for admin review**.
4. If something is missing, **Return project** with a reason.

---

## 6. Dashboard

**Who:** Acmmo Admin only (`/admin`). Office Admin is sent to Projects.

KPI cards are **clickable**. Each card opens the matching filtered project list (or Clients / Billing).

| Card | What it shows | Where it goes |
|------|----------------|---------------|
| Total Clients | All clients | `/admin/clients` |
| Active Projects | Work in progress | Projects, filter **active** |
| Awaiting Assignment | Created, no staff yet | Status = Awaiting Assignment |
| Pending Review | Waiting for Acmmo Admin | Status = Pending Review |
| Correction Required | Rejected work | Status = Correction Required |
| Needs Attention | Review + correction + awaiting + returned | Filter **attention** |
| Plinth level Inspection | Projects on that service | Filter **plinth_inspection** |
| Under Construction | Flag at create/edit | Filter **under_construction** |
| Site Visit Pending | Flag at create/edit | Filter **site_visit_pending** |
| Completed / Closed | Finished work | Matching status |
| Payments Pending | Unpaid / partial | Billing |
| Delayed | Past due date | Filter **delayed** |
| Completed Today | Closed/completed today | (count only) |

Also on the dashboard:

- Department analytics
- Status pie chart
- 6-month revenue trend
- **Needs Attention** list
- Recent payments
- Staff performance

**Needs Attention** uses the same filter as the card. Click the title, **View all**, or the card itself.

---

## 7. Clients

**Path:** `/admin/clients`  
**Who:** Acmmo Admin and Office Admin

### Add a client only

Click **New Client** (or the client dialog button). Fill:

- Name (required)
- Phone (unique — duplicate numbers are blocked)
- Email, address, street
- District (Kerala list)
- Aadhaar and linked numbers (you can add several pairs)

### Add client and project together

Click **Project + Client**. This creates the client, then the project, in one flow. Use this for walk-in registrations.

### Find clients

Filters:

- Search (name, phone, email)
- District
- Has projects / no projects
- Source (office vs other)

Open a client to see linked projects.

---

## 8. Create a project

**Paths**

- Projects → **New Project**
- Clients → **Project + Client**

**Who:** Acmmo Admin, Office Admin  
At least one client must exist for **New Project**.

### Step-by-step

1. **Project name** (required).
2. **Refer name** — who referred the job (optional).
3. **MBook Number** — measurement book number (optional).
4. **Client** — required.
5. **Location** and **Type** (Residential, Commercial, Industrial, Institutional, Renovation, Other).  
   If Type is Other, enter a custom type.  
   For Residential + Architectural Plan / Building Permit, building number and permit number can appear.
6. **Drawing number** (optional; unique when used).
7. **Package**
   - **Full Project** — every active core service in the catalog.
   - **Custom Services** — pick only what this client bought. Only those services appear in the timeline and staff queues.
8. **Required documents** — suggested from the selected services; you can change the list.
9. **Custom fields** — extra office fields, if configured (selected by default).
10. **Project status flags** (multi-select, optional):
    - Site visit pending
    - Under construction
11. **Priority** — Low / Medium / High (High shows **red background, white text**).
12. **Start date** (when your role is allowed) and **Due date**.
13. **Amount (₹)**.
14. **Notes**.
15. Click **Create project**.

### What the system does on create

- Code: `PROJECT-YYYY-####`
- Invoice number reserved: `INV-YYYY-####`
- Status: **Awaiting Assignment**
- Section: **Planning & Design**
- Workflow seeded:
  - Planning
  - For each selected service: **service work** + **Admin Review**
  - Billing
- Document checklist for those services
- Empty KMAP floors (Floor 1, Floor 2)
- Status history: New → Awaiting Assignment
- Project print / PDF opens after success

Add-on services after create: use **Edit project** and assign extra services (for example Plinth-Level Inspection). That service then follows the normal assign → work → submit → review path.

---

## 9. Project list

**Path:** `/admin/projects`

Each row shows **client name in bold**, then the project name.

**Priority:** High-priority rows use a red background, white text, and a red status dot.

**Overdue due dates** show in red (not for Closed / Completed / Cancelled).

### Filters and search

- Text search (project, client, code)
- Status
- Department / section
- Dashboard filters via URL (`?filter=attention`, `active`, `delayed`, `site_visit_pending`, `under_construction`, `plinth_inspection`)
- Page size: 10, 25, 50, 100, or all

### Actions

- Open a project
- Create **New Project**
- Export (where available)
- Print from the project page

---

## 10. Project detail page

**Admin path:** `/admin/projects/[id]`  
**Staff path:** `/staff/projects/[id]`

### Header

Name, code, status / priority / payment badges, amount, progress bar, due date, invoice number, print button.

Acmmo Admin also sees **Edit**, **Delete**, and finance shortcuts (**Add Income** / **Add Expense**) when permitted.

### Layout (admin)

1. Client information (name, phone, email, address)
2. **Workflow Timeline** — the pipeline for *this* project’s services
3. Sidebar: type, location, department, stage, drawing / MBook / refer, assigned staff, status
4. **Department Progress** — assign, approve, reject, close (Acmmo Admin); Admin sees this as view-only
5. Drawing number and MBook
6. KMAP floor areas
7. Tabs:
   - **Documents** — checklist
   - **Files** — drawings, photos, PDFs
   - **Custom Fields**
   - **Billing** — invoices and payments
   - **Activity** — status history, returns, and approval history (on the same page, not a popup)

### Who can edit

| Role | Workflow buttons | Documents / files / KMAP / drawing | Billing |
|------|------------------|-------------------------------------|---------|
| Acmmo Admin | Assign, approve, reject, reassign, move dept, status override, close | Yes, including Closed | Yes |
| Admin | View only | Yes until Closed | Yes |
| Staff | Start / complete / submit / return when assigned | Only while assigned and status is editable | No |
| Billing Staff | Billing-stage projects only | Billing view | Yes |

### Closed projects

- Admin and Staff: read-only details
- Acmmo Admin: can still edit and override
- Billing tab stays available for office billing roles
- Delete (Acmmo Admin) also removes payments, invoices, assignments, and related records (blocked if the system still needs them)

### Print

Use **Print**. The company name on billing / PDF headers is printed **exactly as typed** in Settings (letter case is not changed).

---

## 11. Full project workflow

Work is **service-based**. A full package gets every active service. A custom package gets only the services you selected.

### Pipeline (typical)

```
Create project
    → Awaiting Assignment
    → Acmmo Admin assigns staff
    → Assigned
    → Staff: Start work → In Progress
    → Staff: Mark work completed → Work Completed
    → Staff: Submit for admin review → Pending Review
         ├─ Approve & assign next  → next service / department
         └─ Reject                 → Correction Required → staff starts again
    → … repeat for each selected service …
    → Billing
    → Payments until Paid
    → Acmmo Admin: Close project → Closed
```

Staff can **Return** at any editable moment. Acmmo Admin **reassigns** a returned project.

```
                    ┌──────────────────────┐
                    │  Correction Required │
                    └──────────▲───────────┘
                               │ reject
Create → Assign → Work → Submit → Review ──approve──► Next step
                     │                      │
                     │ return               │ last service + Paid
                     ▼                      ▼
                 Returned              Billing → Close
                     │
                     └── reassign ──► Assign
```

### Default services (catalog)

Acmmo Admin can add, rename, or deactivate services under **Services**. Defaults:

| Service | Department | Typical staff |
|---------|------------|----------------|
| Site Survey / Measurement | Planning & Design | Planning Staff |
| Plinth-Level Inspection | Planning & Design | Planning Staff |
| Architecture Design | Planning & Design | Planning Staff |
| Concept Design | Planning & Design | Planning Staff |
| Plot Sketch | Planning & Design | Planning Staff |
| Building Permit | Building Permit | Permit Staff |
| Permit Renewal | Building Permit | Permit Staff |
| 3D Elevation | 3D & Interior | 3D Staff |
| Interior Design | 3D & Interior | 3D Staff |
| Working Drawings | Estimation & Construction | Estimation Staff |
| Estimation | Estimation & Construction | Estimation Staff |
| Construction Supervision | Estimation & Construction | Estimation Staff |
| Valuation Course | Estimation & Construction | Estimation Staff |

Every selected service is followed by an **Admin Review** step. The last step is always **Billing**.

### Acmmo Admin workflow buttons

| Button | When | Result |
|--------|------|--------|
| Assign staff / team | Active work step (not during review) | Status **Assigned**; staff notified. Multiple people can be assigned on work steps. |
| Approve & assign next | **Pending Review** | Completes review; next work step becomes active |
| Reject — correction required | **Pending Review** | Status **Correction Required**; feedback note stored |
| Reassign | **Returned** | Sends the job back to section staff |
| Move department | Override | Changes section; optional new assignee |
| Update status | Override | Manual status + note in history |
| Close project | Billing step **and** payment **Paid** (if amount &gt; 0) | Status **Closed** |

Office Admin **cannot** press these buttons; they still see the timeline and can edit project details until Closed.

### Staff workflow buttons

| Button | Allowed statuses | Result |
|--------|------------------|--------|
| Start work | Assigned, Correction Required | In Progress |
| Mark work completed | Assigned, In Progress, Correction Required | Work Completed; office notified |
| Submit for admin review | Work Completed, In Progress, Assigned | Current step completed; review step active; Pending Review |
| Return project | While the project is editable | Returned, with reason and notes |

Checklist, KMAP, and files are **not** hard gates — the system does not block submit if they are incomplete. Complete them as office practice.

### Return reasons

Missing Documents · Site Plan Missing · Aadhaar Missing · Tax Receipt Missing · Client Approval Pending · Clarification Required · Setback Issue · Room Size Issue · Other

### Notifications sent automatically

- Project assigned
- Section / step handoff
- Project returned
- Work completed / pending review (office)

Use the bell in the header. Open **Notifications** to mark one or all as read.

---

## 12. Staff portal

**Home:** `/staff`

### Home boxes (all clickable)

| Box | Filter on My Projects |
|-----|------------------------|
| My Assigned | assigned |
| Awaiting Action | awaiting_action |
| In Review | submitted_review |
| Corrections | correction |
| Overdue | overdue |
| Completed | completed |

Pending and in-progress work is listed **first**. High priority is red. Overdue dates are red.

**Department queue** shows jobs in your department that are still awaiting assignment (read-only heads-up).

### My Projects (`/staff/projects`)

- Search
- Filter (same keys as the home boxes)
- **Grid view** or **Table view**
- Mobile-friendly layout

### Opening a project

You can open a project if you **own** it (primary or team assignee) **or** you worked on it before.

You can **edit** only when assigned and status is one of:

Assigned · In Progress · Work Completed · Correction Required · Waiting for Documents · New · Awaiting Assignment

Otherwise the page is view-only (returned, submitted, closed, past work).

On the staff project page:

1. Header (status, priority, section, progress)
2. Actions **or** current status
3. Drawing number (Planning Staff, while in Planning & Design)
4. KMAP
5. Tabs: Checklist · Files · History / Activity

### Attendance (`/staff/attendance`)

See [§17](#17-attendance).

### Expenses (`/staff/expenses`)

Submit claims: Fuel, Travel, Food, Accommodation, Site Visit, Office Purchase. Link to a project when relevant. Track status: Submitted → Dept Review → Admin Approval → Finance Payment → Completed (or Rejected).

### Profile (`/staff/profile`)

Name, avatar, and account details for yourself.

---

## 13. Plinth-level inspection

Plinth-level inspection is a **normal service**, not a separate module.

1. Include it at create time (Full Project, or Custom Services → Plinth-Level Inspection), **or** add it later as an add-on.
2. Acmmo Admin assigns Planning Staff (or the role linked to that service).
3. Staff start work, attach:
   - Plinth Photos
   - Level Measurements
   - Inspection Report
4. Staff submit for review; Acmmo Admin approves like any other step.

The dashboard **Plinth level Inspection** box lists projects currently on that service.

---

## 14. Documents, files, KMAP, drawing numbers

### Documents (checklist)

Suggested from the services on the project. Typical building-permit set includes Possession, Land Tax, Deed, sketches, Aadhaar, consent, permit, cess, and similar items. Mark items **filed** when the paper is in the office file.

### Files

Store file **name and type** (PDF, DWG, JPG, PNG, Excel, ZIP, Other) under categories: Drawing, Permit Document, Photo, Estimate, Other.

### KMAP (area capture)

Floor-wise **plinth area** and **floor area** in square feet. New projects start with Floor 1 and Floor 2. You can add floors up to 50. Totals are shown at the bottom.

### Drawing number and MBook

- Drawing number is unique when filled. Planning Staff can edit it in Planning & Design.
- MBook (edge book) number is the measurement book reference.

### Custom fields

Configured under **Custom Fields** (`/admin/requirements`). Types: text, number, date, yes/no, choice. They appear on create and on the project **Custom Fields** tab.

### Notes and start date

Project notes and start date can be edited on the detail page (until Closed, except Acmmo Admin).

---

## 15. Billing and invoices

**Who:** Acmmo Admin, Billing Staff (and Admin on the project Billing tab / finance)

### Project billing tab

- See project amount, advance received, balance
- Payment status updates automatically: **Unpaid** / **Partially Paid** / **Paid**
- Record payments: Cash, Bank Transfer, UPI, Cheque, Card
- Linked invoices

### Billing dashboard (`/admin/billing`)

Counts and lists for unpaid, partial, and paid work. Counts match the actual payment records.

### Invoices (`/admin/invoices`)

- Overview: total invoices, billed, collected, outstanding
- **New Invoice** (`/admin/invoices/new`) — pick client/project, lines, discounts, terms
- Statuses: Draft, Sent, Pending, Partially Paid, Paid, Overdue, Cancelled
- PDF download; header **company name** matches Settings character-for-character
- Default terms: payment due within 15 days (editable in Settings)

Billing Staff only see projects that have reached the **Billing** section.

---

## 16. Finance

Finance is split into two ledgers so project money and office money stay separate.

**Hub:** `/admin/finance`

### Project Finance (`/admin/finance/project`)

| Page | Use |
|------|-----|
| Dashboard | Totals, shortcuts |
| Income | Advance, stage, final, consultation, drawing, permit, other |
| Expenses | Project costs |
| Budget | Planned vs actual |
| Ledger | Full project ledger |
| Profit Analysis | Income − expense, margin |
| Reports | Charts + downloads |

From a project page, **Add Income** and **Add Expense** jump here with the project selected. You can pick an existing client or **create a new client** from the finance form.

Income / expense statuses: Draft → Approved (or Cancelled). Expenses can also be Submitted, Rejected, Paid.

### Office Finance (`/admin/finance/office`)

| Page | Use |
|------|-----|
| Dashboard | Office cash position |
| Income / Expenses | Office operations |
| Cash Book | Day book |
| Accounts | Cash, petty, bank, UPI |
| Vendors | Supplier records |
| Staff Claims | Approve staff reimbursements |
| Salary | Draft → Approved → Paid |
| Reports | Office downloads |
| Settings | Finance categories and options |

**Acmmo Admin and Office Admin** can manage accounts, vendors, transfers, salary, and settings.  
**Billing Staff** can use dashboards, income, expenses, and reports only.

### Report downloads (separate files)

On Project Reports:

- Monthly report
- Payment history
- Project income
- Project expenses
- Project profit

On Office Reports:

- Monthly report
- Office income
- Office expenses

Pick date range, client, and/or project where offered, then download Excel.

---

## 17. Attendance

### Staff check-in / check-out

**Path:** `/staff/attendance`

1. Allow location in the browser.
2. Stand **inside the office geofence** (default **300 metres** from the office pin).
3. **Check In** once per day, **Check Out** when leaving.
4. Duplicate punches on the same day are blocked.
5. If you check in after office start + buffer (default **09:30** + **10 minutes**), status is **Late Coming** and a popup explains it.

Statuses: **Present**, **Late Coming**, **Absent**.

Check-in outside the radius is rejected with a distance message.

### Acmmo Admin attendance (`/admin/attendance`)

- Filter by date, month, staff, department
- Export **CSV** or **Excel**, or print
- **Manual mark** for site visits and other out-of-office cases (still recorded with reason)

Office coordinates, radius, start time, and buffer are stored in attendance settings (Acmmo Admin).

---

## 18. Departments, services, documents, custom fields

**Who:** Acmmo Admin

### Departments (`/admin/departments`)

Office sections (Planning & Design, Building Permit, 3D & Interior, Estimation & Construction, Billing, plus any you add). Each department maps to a staff role. Moving a project to a department uses this list.

### Services (`/admin/services`)

The catalog used at project create. Inactive services are hidden from new projects but remain on old ones.

### Documents (`/admin/documents`)

Templates per service (the checklist suggestions). Example for plinth: Plinth Photos, Level Measurements, Inspection Report.

### Custom Fields (`/admin/requirements`)

Extra questions on every new project (or selected ones).

---

## 19. Staff, admins, and users

**Who:** Acmmo Admin (Staff page is Super Admin; Office Admin does not manage users)

### Staff (`/admin/staff`)

Create department employees: name, username, password, role(s), avatar, active flag. Roles can be multiple.

### Admin Management (`/admin/admins`)

Create and manage **Admin** (office manager) accounts.

### User Management (`/admin/users`)

All accounts: activate / deactivate, review roles.

Never share Acmmo Admin credentials. Passwords are stored hashed.

---

## 20. Notifications

Bell icon (admin and staff). Unread count on the sidebar.

Typical events: assigned, handoff, returned, work ready for review.

**Notifications** page (`/admin/notifications` for billing/admin): mark one or all read.

---

## 21. Reports, settings, security, audit

**Who:** Acmmo Admin unless noted

### Reports (`/admin/reports`)

Office-level project and performance reports.

### Settings (`/admin/settings`)

Company profile used on invoices and PDFs:

- Company name (printed exactly as typed)
- GST, phone, email, website, address
- Tagline
- Invoice terms
- Bank name, account name, number, IFSC
- UPI ID and payment number / app
- Logo upload

Links through to document templates and custom fields.

### Security (`/admin/security`)

Change the Acmmo Admin password. Keep the new password private.

### Audit Logs (`/admin/audit`)

Privileged actions: login, logout, clients, projects, settings, billing. Includes role and IP where recorded.

---

## 22. Status dictionary

| Status | Meaning |
|--------|---------|
| New | Just created (briefly, then Awaiting Assignment) |
| Awaiting Assignment | Waiting for Acmmo Admin to assign staff |
| Assigned | Staff assigned; work not started |
| In Progress | Staff clicked Start work |
| Work Completed | Staff finished the step; may still submit |
| Pending Review | Waiting for Acmmo Admin approve / reject |
| Approved | Review accepted (then next step) |
| Correction Required | Review rejected; staff must fix |
| Returned | Staff sent the job back to the office |
| Waiting for Client | Hold — client input |
| Waiting for Documents | Hold — papers |
| Waiting for Government Approval | Hold — authority |
| Waiting for Payment | Hold — money |
| On Hold | Manual hold |
| Completed | Work finished (legacy / pipeline end) |
| Closed | Officially closed after billing (Paid) |
| Cancelled | Cancelled |

**Payment:** Unpaid · Partially Paid · Paid  

**Priority:** Low · Medium · High  

**Project types:** Residential · Commercial · Industrial · Institutional · Renovation · Other  

**Create-time flags (not statuses):** Site visit pending · Under construction  

---

## 23. Daily checklists

### Acmmo Admin

- [ ] Open Dashboard — clear **Needs Attention**, **Pending Review**, **Returned**
- [ ] Assign new projects
- [ ] Approve or reject submitted work
- [ ] Check **Site visit pending**, **Under construction**, **Plinth** boxes
- [ ] Review delayed / overdue
- [ ] Close paid billing jobs
- [ ] Glance at attendance and notifications

### Office Admin

- [ ] Register new clients and projects
- [ ] Keep location, flags, documents, and notes accurate
- [ ] Record project income / expenses from the project page
- [ ] Follow up unpaid invoices with Billing

### Billing Staff

- [ ] Billing dashboard counts
- [ ] Create / send invoices
- [ ] Record payments
- [ ] Download payment history and monthly reports as needed

### Department staff

- [ ] Check in (GPS)
- [ ] Clear **Awaiting Action** first, then assigned work
- [ ] Update checklist and files before submit
- [ ] Submit for review the same day work is done
- [ ] Return immediately if documents are missing
- [ ] Check out; submit expense claims with receipts

---

## 24. Tips and common questions

**Why can’t I assign staff?**  
Only **Acmmo Admin** assigns and reviews. Office Admin creates projects; Acmmo Admin assigns them.

**Why is the project read-only?**  
It is Closed / Completed / Cancelled, or you are staff and not the current assignee. Acmmo Admin can still edit Closed jobs.

**Where did my custom service go?**  
Custom package projects only show the services selected at create (plus later add-ons). Full package uses the whole active catalog.

**Location did not change after edit?**  
Use **Edit project** on the project page and save. Location is stored on the project record and should update immediately after a successful save.

**Dashboard box did nothing?**  
Each KPI is a link. Needs Attention goes to `/admin/projects?filter=attention`. If a card does not move, refresh and try the **View all** link in that section.

**Staff home numbers vs list**  
Click the box — My Projects opens with the same filter.

**Can I delete a project?**  
Acmmo Admin can delete. Related payments, invoices, assignments, and workflow data are removed together. The system may block delete if a hard dependency remains.

**Attendance failed**  
Enable GPS, stand inside the radius, and avoid a second check-in the same day. For site visits, ask Acmmo Admin to **mark attendance** manually.

**Finance vs Billing tab**  
Project **Billing** tab = client invoices and receipts against the project amount. **Project Finance** = full ledger (income types, expenses, profit). Use both: invoice the client, then log income in finance if that is office practice.

**Phone already exists**  
Client phones must be unique. Search the directory and open the existing client instead of creating a duplicate.

**High priority**  
Use High only when the job must jump the queue. It is visually loud on purpose (red row).

**Tablet tables**  
Project and staff tables use the full width on tablet — scroll horizontally if columns overflow, there should be no unused gap on the right.

---

## Appendix A — Routes cheat sheet

| Page | URL |
|------|-----|
| Login | `/login` |
| Acmmo Admin dashboard | `/admin` |
| Clients | `/admin/clients` |
| Client detail | `/admin/clients/[id]` |
| Projects | `/admin/projects` |
| Project detail | `/admin/projects/[id]` |
| Departments / Services / Documents / Custom Fields | `/admin/departments` · `/admin/services` · `/admin/documents` · `/admin/requirements` |
| Staff / Attendance / Admins / Users | `/admin/staff` · `/admin/attendance` · `/admin/admins` · `/admin/users` |
| Billing / Invoices | `/admin/billing` · `/admin/invoices` · `/admin/invoices/new` |
| Finance hub | `/admin/finance` |
| Project finance | `/admin/finance/project` … `/income` `/expenses` `/budget` `/ledger` `/profit` `/reports` |
| Office finance | `/admin/finance/office` … `/income` `/expenses` `/cash-book` `/accounts` `/vendors` `/claims` `/salary` `/reports` `/settings` |
| Reports / Notifications / Settings / Security / Audit | `/admin/reports` · `/admin/notifications` · `/admin/settings` · `/admin/security` · `/admin/audit` |
| Staff home / projects / attendance / expenses / profile | `/staff` · `/staff/projects` · `/staff/attendance` · `/staff/expenses` · `/staff/profile` |
| Staff project | `/staff/projects/[id]` |

---

## Appendix B — Who does each step

| Step | Actor |
|------|--------|
| Create client / project, pick services and documents | Admin or Acmmo Admin |
| Set Site visit pending / Under construction | Admin or Acmmo Admin |
| Assign staff to current step | Acmmo Admin |
| Start, complete, submit, return | Assigned staff |
| Approve or reject review | Acmmo Admin |
| Reassign returned work | Acmmo Admin |
| Record invoices and payments | Acmmo Admin, Billing Staff, Admin (project billing) |
| Add project income / expense | Admin, Acmmo Admin, Billing (within finance rights) |
| Close project (Paid) | Acmmo Admin |
| Edit a closed project | Acmmo Admin only |
| Check in / out | Staff |
| Manual attendance | Acmmo Admin |
| Change company name / password | Acmmo Admin |

---

*ACMMO Architects — Office System User Guide. For internal office use. Workflow and screens match the live website as of September 2026.*

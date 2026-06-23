# ArchPermit Office

Architecture & Building Permit Management System — track every project from site visit to handover. Manage clients, workflow stages, staff assignments, document checklists, billing, and notifications in one place.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4, shadcn/ui |
| Database | PostgreSQL (via `postgres` driver) |
| Charts | Recharts |
| Auth | Cookie-based session (`ao_session`) |

---

## Features

### Authentication & Roles

- Login with username/password
- Role-based redirect: **Admin** → `/admin`, staff → `/staff`
- Five user roles: Admin, Planning Staff, Permit Staff, 3D Staff, Estimation Staff
- Secure HTTP-only session cookie (7-day expiry)

### Admin Dashboard

- Office overview with key metrics: total, active, returned, and completed projects
- Revenue collected and outstanding balance (INR)
- Charts: projects by section (bar), status breakdown (pie)
- Recent projects list with quick links

### Client Management

- Create, edit, and search clients (name, phone, email)
- Client detail page with linked projects
- Duplicate phone number validation

### Project Management

- Auto-generated project codes (`PROJECT-YYYY-0001`)
- Auto-generated invoice numbers (`INV-YYYY-XXXX`)
- Project fields: name, client, location, type, priority, due date, amount
- Assign projects to staff members
- Filter and search projects by status, section, priority, and text
- Document checklist (10 standard items: Aadhaar, PAN, Title Deed, etc.)
- Project file tracking (name and type metadata)
- Status history timeline
- Return history with reasons

### Workflow Engine

- 10 ordered lifecycle stages across 4 sections
- Advance stage action moves projects through the pipeline
- Automatic section handoff notifications to the next staff role
- Manual status updates (New, Assigned, In Progress, Pending, Returned, Completed)
- Return project flow with predefined reasons

### Billing & Payments

- Record payments (Cash, Bank Transfer, UPI, Cheque, Card)
- Track project amount vs. advance received
- Auto-computed payment status: Unpaid, Partially Paid, Paid

### Notifications

- In-app notification bell for admins and staff
- Triggers: project assigned, section handoff, project returned
- Mark individual or all notifications as read

### Staff Portal (backend ready)

- Staff users see only their assigned projects
- Advance stages, update status, manage checklist and files
- Return projects to office with notes

---

## Project Workflow

Every project moves through **10 stages** grouped into **4 sections**. Each section is owned by a dedicated staff role.

```mermaid
flowchart LR
  subgraph P["Planning & Design"]
    S1[Site Visit & Measurement]
    S2[Concept Design]
  end
  subgraph B["Building Permit"]
    S3[Permit Drawings]
    S4[Permit Submission & Approval]
  end
  subgraph D["3D & Interior"]
    S5[3D Elevation Views]
    S6[Interior Design]
  end
  subgraph E["Estimation & Construction"]
    S7[Working Drawings]
    S8[Cost Estimation]
    S9[Construction Supervision]
    S10[Project Handover]
  end
  S1 --> S2 --> S3 --> S4 --> S5 --> S6 --> S7 --> S8 --> S9 --> S10
```

### Stages

| # | Stage | Section | Staff Role |
|---|-------|---------|------------|
| 1 | Site Visit & Measurement | Planning & Design | Planning Staff |
| 2 | Concept Design | Planning & Design | Planning Staff |
| 3 | Permit Drawings | Building Permit | Permit Staff |
| 4 | Permit Submission & Approval | Building Permit | Permit Staff |
| 5 | 3D Elevation Views | 3D & Interior | 3D Staff |
| 6 | Interior Design | 3D & Interior | 3D Staff |
| 7 | Working Drawings | Estimation & Construction | Estimation Staff |
| 8 | Cost Estimation | Estimation & Construction | Estimation Staff |
| 9 | Construction Supervision | Estimation & Construction | Estimation Staff |
| 10 | Project Handover | Estimation & Construction | Estimation Staff |

### Status Lifecycle

```
New → Assigned → In Progress → … → Completed
                      ↓
                  Returned (back to office)
                      ↓
                  Pending (manual hold)
```

### Typical Flow

1. **Admin** creates a client and a new project (status: `New`, stage 0).
2. **Admin** assigns the project to a staff member (status: `Assigned`).
3. **Staff** works through checklist items and uploads file references.
4. **Staff** advances the stage when work is done (status: `In Progress`).
5. When the section changes, the next role receives a **Section Handoff** notification.
6. If documents or info are missing, **Staff** can **Return** the project to the office.
7. After stage 10, the project is marked **Completed** and unassigned.
8. **Admin** records payments; payment status updates automatically.

### Return Reasons

- Missing Documents
- Incorrect Information
- Client Approval Pending
- Needs Revision
- Out of Scope
- Other

### Document Checklist

Aadhaar Card, PAN Card, Title Deed, Possession Certificate, Land Tax Receipt, Location Sketch, Survey Sketch, Site Plan, Ownership Certificate, Other Documents.

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (local or hosted, e.g. Neon)

### Environment

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
TABLE_PAGE_SIZE=10
```

The app also accepts `POSTGRES_URL`, `DATABASE_URL_UNPOOLED`, or `POSTGRES_URL_NON_POOLING`.

`TABLE_PAGE_SIZE` sets the default rows per page for dashboard tables (10, 25, 50, 100, or all are selectable in the UI).

### Install & Run

```bash
npm install
npm run db:setup    # Create tables and default users
npm run db:seed     # Optional: load sample clients and projects
npm run dev         # Start at http://localhost:3000
```

### Default Login Credentials

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Admin |
| `planning` | `plan123` | Planning Staff |
| `permit` | `permit123` | Permit Staff |
| `3d` | `3d123` | 3D Staff |
| `estimate` | `est123` | Estimation Staff |

---

## Project Structure

```
app/
  admin/          # Admin dashboard, clients (projects UI in progress)
  login/          # Login page
  page.tsx        # Root redirect based on role
components/       # UI components (sidebar, dialogs, charts, badges)
lib/
  actions.ts      # Server actions (CRUD, workflow, auth)
  auth.ts         # Session management
  constants.ts    # Workflow stages, roles, statuses
  db.ts           # PostgreSQL connection
  queries.ts      # Database read queries
  types.ts        # TypeScript interfaces
scripts/
  schema.sql      # Database schema
  setup-db.mjs    # Reset DB and seed users
  seed-db.mjs     # Sample data
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:setup` | Drop/recreate tables and default users |
| `npm run db:seed` | Insert sample clients and projects |

---

## Changelog

> **Update this section with every change** — add a new dated entry at the top describing what was added, changed, or fixed.

### 2026-06-17 — P0 implementation (workflow, projects UI, staff portal)

- **Added** `/admin/projects` list and detail pages with assignment, workflow, checklist, files, billing, history
- **Added** `/staff` portal with work queue and project detail (advance, submit for review, return)
- **Added** admin review workflow: submit → Pending Review → approve/reject → next department
- **Added** department assignment (`assignToDepartment`), returned project inbox, project closure after billing
- **Added** bcrypt password hashing, auth middleware, action-level authorization
- **Added** audit_logs table, expanded statuses/return reasons, checklist review status
- **Added** combined client + project registration dialog
- **Updated** dashboard with required KPIs, staff performance, recent payments, attention queue
- **Updated** schema indexes and sequential invoice numbers

### 2026-06-17 — Initial release

- **Added** PostgreSQL schema: users, clients, projects, checklist, status/return history, files, payments, notifications
- **Added** 10-stage project workflow across 4 sections with role-based handoffs
- **Added** Admin dashboard with stats, charts, and recent projects
- **Added** Client management (list, search, create, edit, detail with projects)
- **Added** Server actions for project CRUD, assignment, stage advancement, returns, payments
- **Added** Cookie-based authentication with role routing
- **Added** Notification system (assign, handoff, return events)
- **Added** Database setup and seed scripts with default users
- **Added** Document checklist (10 standard permit documents)
- **Added** Payment recording with auto status (Unpaid / Partially Paid / Paid)

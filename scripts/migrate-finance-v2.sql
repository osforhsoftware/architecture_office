-- Finance v2: Split Project Finance vs Office Finance into separate ledgers
-- Safe to re-run. Migrates data from finance_income / finance_expenses when present.

SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- Shared: ensure Federal Bank account exists
-- ---------------------------------------------------------------------------

INSERT IGNORE INTO finance_accounts (name, account_type, opening_balance, current_balance)
VALUES ('Federal Bank', 'bank', 0, 0);

-- ---------------------------------------------------------------------------
-- Category scope (project | office | both)
-- ---------------------------------------------------------------------------

ALTER TABLE income_categories
  ADD COLUMN IF NOT EXISTS scope VARCHAR(20) NOT NULL DEFAULT 'both';

ALTER TABLE expense_categories
  ADD COLUMN IF NOT EXISTS scope VARCHAR(20) NOT NULL DEFAULT 'both';

-- ---------------------------------------------------------------------------
-- PROJECT FINANCE TABLES
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS project_income (
  id                INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  receipt_number    VARCHAR(50)  NOT NULL,
  income_date       DATE         NOT NULL,
  client_id         INT,
  project_id        INT NOT NULL,
  invoice_id        INT,
  category_id       INT,
  account_id        INT,
  payment_method    VARCHAR(100) NOT NULL,
  amount            DECIMAL(14,2) NOT NULL,
  reference_number  VARCHAR(255),
  notes             TEXT,
  attachment_path   TEXT,
  status            VARCHAR(50)  NOT NULL DEFAULT 'Approved',
  created_by        INT,
  approved_by       INT,
  approved_at       DATETIME,
  deleted_at        DATETIME,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_project_income_receipt (receipt_number),
  CONSTRAINT fk_pi_client   FOREIGN KEY (client_id)   REFERENCES clients(id)            ON DELETE SET NULL,
  CONSTRAINT fk_pi_project  FOREIGN KEY (project_id)  REFERENCES projects(id)           ON DELETE CASCADE,
  CONSTRAINT fk_pi_invoice  FOREIGN KEY (invoice_id)  REFERENCES invoices(id)           ON DELETE SET NULL,
  CONSTRAINT fk_pi_category FOREIGN KEY (category_id) REFERENCES income_categories(id)  ON DELETE SET NULL,
  CONSTRAINT fk_pi_account  FOREIGN KEY (account_id)  REFERENCES finance_accounts(id)   ON DELETE SET NULL,
  CONSTRAINT fk_pi_creator  FOREIGN KEY (created_by)  REFERENCES app_users(id)          ON DELETE SET NULL,
  CONSTRAINT fk_pi_approver FOREIGN KEY (approved_by) REFERENCES app_users(id)          ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_expenses (
  id                INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  expense_number    VARCHAR(50)  NOT NULL,
  expense_date      DATE         NOT NULL,
  vendor_id         INT,
  project_id        INT NOT NULL,
  category_id       INT,
  account_id        INT,
  amount            DECIMAL(14,2) NOT NULL,
  gst_amount        DECIMAL(14,2) NOT NULL DEFAULT 0,
  payment_method    VARCHAR(100) NOT NULL,
  reference_number  VARCHAR(255),
  notes             TEXT,
  bill_path         TEXT,
  status            VARCHAR(50)  NOT NULL DEFAULT 'Draft',
  created_by        INT,
  approved_by       INT,
  approved_at       DATETIME,
  paid_at           DATETIME,
  deleted_at        DATETIME,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_project_expenses_number (expense_number),
  CONSTRAINT fk_pe_vendor   FOREIGN KEY (vendor_id)   REFERENCES vendors(id)              ON DELETE SET NULL,
  CONSTRAINT fk_pe_project  FOREIGN KEY (project_id)  REFERENCES projects(id)             ON DELETE CASCADE,
  CONSTRAINT fk_pe_category FOREIGN KEY (category_id) REFERENCES expense_categories(id)   ON DELETE SET NULL,
  CONSTRAINT fk_pe_account  FOREIGN KEY (account_id)  REFERENCES finance_accounts(id)     ON DELETE SET NULL,
  CONSTRAINT fk_pe_creator  FOREIGN KEY (created_by)  REFERENCES app_users(id)            ON DELETE SET NULL,
  CONSTRAINT fk_pe_approver FOREIGN KEY (approved_by) REFERENCES app_users(id)            ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_budget (
  id                INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id        INT NOT NULL,
  category          VARCHAR(100) NOT NULL,
  estimated_amount  DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes             TEXT,
  created_by        INT,
  deleted_at        DATETIME,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_project_budget_cat (project_id, category),
  CONSTRAINT fk_pb_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_pb_creator FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_ledger (
  id               INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id       INT NOT NULL,
  entry_date       DATE NOT NULL,
  transaction_id   VARCHAR(50) NOT NULL,
  income_amount    DECIMAL(14,2) NOT NULL DEFAULT 0,
  expense_amount   DECIMAL(14,2) NOT NULL DEFAULT 0,
  balance          DECIMAL(14,2) NOT NULL DEFAULT 0,
  payment_method   VARCHAR(100),
  description      TEXT,
  entry_type       VARCHAR(50) NOT NULL DEFAULT 'transaction',
  ref_type         VARCHAR(50),
  ref_id           INT,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pl_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- project_profit is alias conceptually of project_finance (already exists)
-- Ensure columns for budget tracking
ALTER TABLE project_finance
  ADD COLUMN IF NOT EXISTS total_budget DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS budget_used_percent DECIMAL(8,2) NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- OFFICE FINANCE TABLES
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS office_income (
  id                INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  receipt_number    VARCHAR(50)  NOT NULL,
  income_date       DATE         NOT NULL,
  category_id       INT,
  account_id        INT,
  payment_method    VARCHAR(100) NOT NULL,
  amount            DECIMAL(14,2) NOT NULL,
  reference_number  VARCHAR(255),
  notes             TEXT,
  attachment_path   TEXT,
  status            VARCHAR(50)  NOT NULL DEFAULT 'Approved',
  created_by        INT,
  approved_by       INT,
  approved_at       DATETIME,
  deleted_at        DATETIME,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_office_income_receipt (receipt_number),
  CONSTRAINT fk_oi_category FOREIGN KEY (category_id) REFERENCES income_categories(id)  ON DELETE SET NULL,
  CONSTRAINT fk_oi_account  FOREIGN KEY (account_id)  REFERENCES finance_accounts(id)   ON DELETE SET NULL,
  CONSTRAINT fk_oi_creator  FOREIGN KEY (created_by)  REFERENCES app_users(id)          ON DELETE SET NULL,
  CONSTRAINT fk_oi_approver FOREIGN KEY (approved_by) REFERENCES app_users(id)          ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS office_expenses (
  id                INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  expense_number    VARCHAR(50)  NOT NULL,
  expense_date      DATE         NOT NULL,
  vendor_id         INT,
  category_id       INT,
  account_id        INT,
  amount            DECIMAL(14,2) NOT NULL,
  gst_amount        DECIMAL(14,2) NOT NULL DEFAULT 0,
  payment_method    VARCHAR(100) NOT NULL,
  reference_number  VARCHAR(255),
  notes             TEXT,
  bill_path         TEXT,
  status            VARCHAR(50)  NOT NULL DEFAULT 'Draft',
  created_by        INT,
  approved_by       INT,
  approved_at       DATETIME,
  paid_at           DATETIME,
  deleted_at        DATETIME,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_office_expenses_number (expense_number),
  CONSTRAINT fk_oe_vendor   FOREIGN KEY (vendor_id)   REFERENCES vendors(id)              ON DELETE SET NULL,
  CONSTRAINT fk_oe_category FOREIGN KEY (category_id) REFERENCES expense_categories(id)   ON DELETE SET NULL,
  CONSTRAINT fk_oe_account  FOREIGN KEY (account_id)  REFERENCES finance_accounts(id)     ON DELETE SET NULL,
  CONSTRAINT fk_oe_creator  FOREIGN KEY (created_by)  REFERENCES app_users(id)            ON DELETE SET NULL,
  CONSTRAINT fk_oe_approver FOREIGN KEY (approved_by) REFERENCES app_users(id)            ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- SALARY MANAGEMENT
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS salary_payroll (
  id                INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  payslip_number    VARCHAR(50) NOT NULL,
  staff_id          INT NOT NULL,
  pay_period        VARCHAR(20) NOT NULL,
  pay_date          DATE NOT NULL,
  basic_salary      DECIMAL(14,2) NOT NULL DEFAULT 0,
  allowances        DECIMAL(14,2) NOT NULL DEFAULT 0,
  bonus             DECIMAL(14,2) NOT NULL DEFAULT 0,
  overtime          DECIMAL(14,2) NOT NULL DEFAULT 0,
  deductions        DECIMAL(14,2) NOT NULL DEFAULT 0,
  net_salary        DECIMAL(14,2) NOT NULL DEFAULT 0,
  payment_method    VARCHAR(100),
  account_id        INT,
  status            VARCHAR(50) NOT NULL DEFAULT 'Draft',
  notes             TEXT,
  paid_at           DATETIME,
  created_by        INT,
  deleted_at        DATETIME,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_salary_payslip (payslip_number),
  UNIQUE KEY uq_salary_staff_period (staff_id, pay_period),
  CONSTRAINT fk_sal_staff   FOREIGN KEY (staff_id)   REFERENCES app_users(id)        ON DELETE CASCADE,
  CONSTRAINT fk_sal_account FOREIGN KEY (account_id) REFERENCES finance_accounts(id) ON DELETE SET NULL,
  CONSTRAINT fk_sal_creator FOREIGN KEY (created_by) REFERENCES app_users(id)        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Shared transactions: add ledger_scope
-- ---------------------------------------------------------------------------

ALTER TABLE finance_transactions
  ADD COLUMN IF NOT EXISTS ledger_scope VARCHAR(20) NOT NULL DEFAULT 'office';

ALTER TABLE cash_book
  ADD COLUMN IF NOT EXISTS ledger_scope VARCHAR(20) NOT NULL DEFAULT 'office';

-- ---------------------------------------------------------------------------
-- Seed project vs office category scopes
-- ---------------------------------------------------------------------------

UPDATE income_categories SET scope = 'project'
WHERE name IN ('Project Advance','Project Final Payment','Permit Fee','Interior Design','Drawing Fee');

UPDATE income_categories SET scope = 'office'
WHERE name IN ('Consultation');

INSERT IGNORE INTO income_categories (name, icon, color, sort_order, scope) VALUES
  ('Stage Payment', 'Layers', '#059669', 8, 'project'),
  ('Consultation Income', 'MessageSquare', '#2563eb', 10, 'office'),
  ('Office Services', 'Briefcase', '#7c3aed', 11, 'office'),
  ('Commission', 'Percent', '#db2777', 12, 'office'),
  ('Rental Income', 'Home', '#ea580c', 13, 'office'),
  ('Interest Income', 'TrendingUp', '#0891b2', 14, 'office');

UPDATE expense_categories SET scope = 'office'
WHERE name IN ('Salary','Rent','Internet','Electricity','Water','Marketing','Subscriptions','Maintenance','Office Supplies');

UPDATE expense_categories SET scope = 'project'
WHERE name IN ('Permit Charges','Printing','Fuel','Travel','Material Purchase');

INSERT IGNORE INTO expense_categories (name, icon, color, sort_order, scope) VALUES
  ('Site Visit', 'MapPin', '#0ea5e9', 20, 'project'),
  ('Survey', 'Compass', '#6366f1', 21, 'project'),
  ('Labour', 'HardHat', '#b45309', 22, 'project'),
  ('Materials', 'Package', '#a16207', 23, 'project'),
  ('Transportation', 'Truck', '#475569', 24, 'project'),
  ('Consultant Fee', 'UserCheck', '#7c3aed', 25, 'project'),
  ('Contractor Payment', 'Handshake', '#be123c', 26, 'project'),
  ('Planning', 'PencilRuler', '#2563eb', 10, 'project'),
  ('Permit', 'Stamp', '#7c3aed', 11, 'project'),
  ('3D', 'Box', '#0891b2', 12, 'project'),
  ('Construction', 'HardHat', '#ea580c', 13, 'project'),
  ('Office Rent', 'Building', '#ea580c', 30, 'office'),
  ('Software Subscription', 'Cloud', '#8b5cf6', 31, 'office'),
  ('Furniture', 'Armchair', '#78716c', 32, 'office'),
  ('Equipment', 'Monitor', '#334155', 33, 'office'),
  ('Stationery', 'Pencil', '#64748b', 34, 'office'),
  ('Tea & Snacks', 'Coffee', '#d97706', 35, 'office'),
  ('Vehicle Expense', 'Car', '#dc2626', 36, 'office'),
  ('Office Purchase', 'ShoppingCart', '#059669', 37, 'office');

-- ---------------------------------------------------------------------------
-- Migrate existing finance_income / finance_expenses into split tables
-- ---------------------------------------------------------------------------

INSERT IGNORE INTO project_income (
  id, receipt_number, income_date, client_id, project_id, invoice_id, category_id,
  account_id, payment_method, amount, reference_number, notes, attachment_path,
  status, created_by, approved_by, approved_at, deleted_at, created_at, updated_at
)
SELECT
  id, receipt_number, income_date, client_id, project_id, invoice_id, category_id,
  account_id, payment_method, amount, reference_number, notes, attachment_path,
  status, created_by, approved_by, approved_at, deleted_at, created_at, updated_at
FROM finance_income
WHERE project_id IS NOT NULL;

INSERT IGNORE INTO office_income (
  id, receipt_number, income_date, category_id, account_id, payment_method, amount,
  reference_number, notes, attachment_path, status, created_by, approved_by,
  approved_at, deleted_at, created_at, updated_at
)
SELECT
  id, receipt_number, income_date, category_id, account_id, payment_method, amount,
  reference_number, notes, attachment_path, status, created_by, approved_by,
  approved_at, deleted_at, created_at, updated_at
FROM finance_income
WHERE project_id IS NULL;

INSERT IGNORE INTO project_expenses (
  id, expense_number, expense_date, vendor_id, project_id, category_id, account_id,
  amount, gst_amount, payment_method, reference_number, notes, bill_path, status,
  created_by, approved_by, approved_at, paid_at, deleted_at, created_at, updated_at
)
SELECT
  id, expense_number, expense_date, vendor_id, project_id, category_id, account_id,
  amount, gst_amount, payment_method, reference_number, notes, bill_path, status,
  created_by, approved_by, approved_at, paid_at, deleted_at, created_at, updated_at
FROM finance_expenses
WHERE project_id IS NOT NULL;

INSERT IGNORE INTO office_expenses (
  id, expense_number, expense_date, vendor_id, category_id, account_id,
  amount, gst_amount, payment_method, reference_number, notes, bill_path, status,
  created_by, approved_by, approved_at, paid_at, deleted_at, created_at, updated_at
)
SELECT
  id, expense_number, expense_date, vendor_id, category_id, account_id,
  amount, gst_amount, payment_method, reference_number, notes, bill_path, status,
  created_by, approved_by, approved_at, paid_at, deleted_at, created_at, updated_at
FROM finance_expenses
WHERE project_id IS NULL;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_pi_project ON project_income(project_id);
CREATE INDEX IF NOT EXISTS idx_pi_date ON project_income(income_date);
CREATE INDEX IF NOT EXISTS idx_pe_project ON project_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_pe_date ON project_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_pl_project ON project_ledger(project_id);
CREATE INDEX IF NOT EXISTS idx_pl_date ON project_ledger(entry_date);
CREATE INDEX IF NOT EXISTS idx_pb_project ON project_budget(project_id);
CREATE INDEX IF NOT EXISTS idx_oi_date ON office_income(income_date);
CREATE INDEX IF NOT EXISTS idx_oe_date ON office_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_salary_staff ON salary_payroll(staff_id);
CREATE INDEX IF NOT EXISTS idx_salary_period ON salary_payroll(pay_period);
CREATE INDEX IF NOT EXISTS idx_ft_scope ON finance_transactions(ledger_scope);
CREATE INDEX IF NOT EXISTS idx_cb_scope ON cash_book(ledger_scope);

SET FOREIGN_KEY_CHECKS = 1;

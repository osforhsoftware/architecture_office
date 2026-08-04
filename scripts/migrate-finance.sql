-- Finance & Expense Management Module
-- Safe to re-run (IF NOT EXISTS). Does not alter existing tables.

SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS income_categories (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  icon        VARCHAR(100) DEFAULT 'CircleDollarSign',
  color       VARCHAR(50)  DEFAULT '#16a34a',
  active      TINYINT(1)   DEFAULT 1,
  sort_order  INT          DEFAULT 0,
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_income_categories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expense_categories (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  icon        VARCHAR(100) DEFAULT 'Receipt',
  color       VARCHAR(50)  DEFAULT '#dc2626',
  active      TINYINT(1)   DEFAULT 1,
  sort_order  INT          DEFAULT 0,
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_expense_categories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Accounts (Cash, Petty Cash, Banks, UPI)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS finance_accounts (
  id               INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  account_type     VARCHAR(50)  NOT NULL DEFAULT 'bank',
  bank_name        VARCHAR(255),
  account_number   VARCHAR(100),
  opening_balance  DECIMAL(14,2) NOT NULL DEFAULT 0,
  current_balance  DECIMAL(14,2) NOT NULL DEFAULT 0,
  active           TINYINT(1)    DEFAULT 1,
  notes            TEXT,
  deleted_at       DATETIME,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_finance_accounts_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Vendors
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS vendors (
  id                   INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name                 VARCHAR(500) NOT NULL,
  phone                VARCHAR(50),
  email                VARCHAR(255),
  gst                  VARCHAR(50),
  address              TEXT,
  notes                TEXT,
  outstanding_balance  DECIMAL(14,2) NOT NULL DEFAULT 0,
  active               TINYINT(1) DEFAULT 1,
  deleted_at           DATETIME,
  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Income (received payments)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS finance_income (
  id                INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  receipt_number    VARCHAR(50)  NOT NULL,
  income_date       DATE         NOT NULL,
  client_id         INT,
  project_id        INT,
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
  UNIQUE KEY uq_finance_income_receipt (receipt_number),
  CONSTRAINT fk_fi_client   FOREIGN KEY (client_id)   REFERENCES clients(id)            ON DELETE SET NULL,
  CONSTRAINT fk_fi_project  FOREIGN KEY (project_id)  REFERENCES projects(id)           ON DELETE SET NULL,
  CONSTRAINT fk_fi_invoice  FOREIGN KEY (invoice_id)  REFERENCES invoices(id)           ON DELETE SET NULL,
  CONSTRAINT fk_fi_category FOREIGN KEY (category_id) REFERENCES income_categories(id)  ON DELETE SET NULL,
  CONSTRAINT fk_fi_account  FOREIGN KEY (account_id)  REFERENCES finance_accounts(id)   ON DELETE SET NULL,
  CONSTRAINT fk_fi_creator  FOREIGN KEY (created_by)  REFERENCES app_users(id)          ON DELETE SET NULL,
  CONSTRAINT fk_fi_approver FOREIGN KEY (approved_by) REFERENCES app_users(id)          ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Expenses
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS finance_expenses (
  id                INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  expense_number    VARCHAR(50)  NOT NULL,
  expense_date      DATE         NOT NULL,
  vendor_id         INT,
  project_id        INT,
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
  UNIQUE KEY uq_finance_expenses_number (expense_number),
  CONSTRAINT fk_fe_vendor   FOREIGN KEY (vendor_id)   REFERENCES vendors(id)              ON DELETE SET NULL,
  CONSTRAINT fk_fe_project  FOREIGN KEY (project_id)  REFERENCES projects(id)             ON DELETE SET NULL,
  CONSTRAINT fk_fe_category FOREIGN KEY (category_id) REFERENCES expense_categories(id)   ON DELETE SET NULL,
  CONSTRAINT fk_fe_account  FOREIGN KEY (account_id)  REFERENCES finance_accounts(id)     ON DELETE SET NULL,
  CONSTRAINT fk_fe_creator  FOREIGN KEY (created_by)  REFERENCES app_users(id)            ON DELETE SET NULL,
  CONSTRAINT fk_fe_approver FOREIGN KEY (approved_by) REFERENCES app_users(id)            ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Staff expense claims
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS staff_expenses (
  id                  INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  claim_number        VARCHAR(50)  NOT NULL,
  staff_id            INT NOT NULL,
  project_id          INT,
  category            VARCHAR(100) NOT NULL,
  amount              DECIMAL(14,2) NOT NULL,
  claim_date          DATE NOT NULL,
  receipt_path        TEXT,
  gps_lat             DECIMAL(10,7),
  gps_lng             DECIMAL(10,7),
  notes               TEXT,
  status              VARCHAR(50) NOT NULL DEFAULT 'Submitted',
  dept_reviewed_by    INT,
  dept_reviewed_at    DATETIME,
  admin_approved_by   INT,
  admin_approved_at   DATETIME,
  paid_by             INT,
  paid_at             DATETIME,
  account_id          INT,
  rejection_reason    TEXT,
  deleted_at          DATETIME,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_staff_expenses_claim (claim_number),
  CONSTRAINT fk_se_staff    FOREIGN KEY (staff_id)          REFERENCES app_users(id)        ON DELETE CASCADE,
  CONSTRAINT fk_se_project  FOREIGN KEY (project_id)        REFERENCES projects(id)         ON DELETE SET NULL,
  CONSTRAINT fk_se_dept     FOREIGN KEY (dept_reviewed_by)  REFERENCES app_users(id)        ON DELETE SET NULL,
  CONSTRAINT fk_se_admin    FOREIGN KEY (admin_approved_by) REFERENCES app_users(id)        ON DELETE SET NULL,
  CONSTRAINT fk_se_paid     FOREIGN KEY (paid_by)           REFERENCES app_users(id)        ON DELETE SET NULL,
  CONSTRAINT fk_se_account  FOREIGN KEY (account_id)        REFERENCES finance_accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Vendor payments
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS vendor_payments (
  id              INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  vendor_id       INT NOT NULL,
  expense_id      INT,
  amount          DECIMAL(14,2) NOT NULL,
  payment_date    DATE NOT NULL,
  payment_method  VARCHAR(100) NOT NULL,
  account_id      INT,
  reference       VARCHAR(255),
  notes           TEXT,
  created_by      INT,
  deleted_at      DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_vp_vendor  FOREIGN KEY (vendor_id)  REFERENCES vendors(id)            ON DELETE CASCADE,
  CONSTRAINT fk_vp_expense FOREIGN KEY (expense_id) REFERENCES finance_expenses(id)   ON DELETE SET NULL,
  CONSTRAINT fk_vp_account FOREIGN KEY (account_id) REFERENCES finance_accounts(id)   ON DELETE SET NULL,
  CONSTRAINT fk_vp_creator FOREIGN KEY (created_by) REFERENCES app_users(id)          ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Bank / account transfers
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bank_transfers (
  id                INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  transfer_number   VARCHAR(50) NOT NULL,
  from_account_id   INT NOT NULL,
  to_account_id     INT NOT NULL,
  amount            DECIMAL(14,2) NOT NULL,
  transfer_date     DATE NOT NULL,
  reference         VARCHAR(255),
  notes             TEXT,
  created_by        INT,
  deleted_at        DATETIME,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_bank_transfers_number (transfer_number),
  CONSTRAINT fk_bt_from    FOREIGN KEY (from_account_id) REFERENCES finance_accounts(id),
  CONSTRAINT fk_bt_to      FOREIGN KEY (to_account_id)   REFERENCES finance_accounts(id),
  CONSTRAINT fk_bt_creator FOREIGN KEY (created_by)      REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Unified transactions ledger
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS finance_transactions (
  id                  INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  transaction_number  VARCHAR(50)  NOT NULL,
  transaction_date    DATE         NOT NULL,
  txn_type            VARCHAR(50)  NOT NULL,
  account_id          INT,
  amount              DECIMAL(14,2) NOT NULL,
  direction           VARCHAR(10)  NOT NULL,
  payment_method      VARCHAR(100),
  project_id          INT,
  description         TEXT,
  ref_type            VARCHAR(50),
  ref_id              INT,
  created_by          INT,
  deleted_at          DATETIME,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_finance_txn_number (transaction_number),
  CONSTRAINT fk_ft_account FOREIGN KEY (account_id)  REFERENCES finance_accounts(id) ON DELETE SET NULL,
  CONSTRAINT fk_ft_project FOREIGN KEY (project_id)  REFERENCES projects(id)         ON DELETE SET NULL,
  CONSTRAINT fk_ft_creator FOREIGN KEY (created_by)  REFERENCES app_users(id)        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Cash book (running ledger / khatabook)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cash_book (
  id               INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  entry_date       DATE NOT NULL,
  transaction_id   VARCHAR(50) NOT NULL,
  income_amount    DECIMAL(14,2) NOT NULL DEFAULT 0,
  expense_amount   DECIMAL(14,2) NOT NULL DEFAULT 0,
  balance          DECIMAL(14,2) NOT NULL DEFAULT 0,
  account_id       INT,
  payment_method   VARCHAR(100),
  project_id       INT,
  description      TEXT,
  entry_type       VARCHAR(50) NOT NULL DEFAULT 'transaction',
  ref_type         VARCHAR(50),
  ref_id           INT,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cb_account FOREIGN KEY (account_id) REFERENCES finance_accounts(id) ON DELETE SET NULL,
  CONSTRAINT fk_cb_project FOREIGN KEY (project_id) REFERENCES projects(id)         ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Project finance summary (cached aggregates)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS project_finance (
  id                 INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id         INT NOT NULL,
  project_value      DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_income       DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_expense      DECIMAL(14,2) NOT NULL DEFAULT 0,
  advance_received   DECIMAL(14,2) NOT NULL DEFAULT 0,
  balance_amount     DECIMAL(14,2) NOT NULL DEFAULT 0,
  net_profit         DECIMAL(14,2) NOT NULL DEFAULT 0,
  profit_percent     DECIMAL(8,2)  NOT NULL DEFAULT 0,
  updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_project_finance_project (project_id),
  CONSTRAINT fk_pf_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Attachments
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS finance_attachments (
  id           INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  entity_type  VARCHAR(50)  NOT NULL,
  entity_id    INT          NOT NULL,
  file_name    VARCHAR(500) NOT NULL,
  file_path    TEXT         NOT NULL,
  mime_type    VARCHAR(100),
  uploaded_by  INT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fa_uploader FOREIGN KEY (uploaded_by) REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Approval logs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS approval_logs (
  id           INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  entity_type  VARCHAR(50)  NOT NULL,
  entity_id    INT          NOT NULL,
  action       VARCHAR(100) NOT NULL,
  from_status  VARCHAR(50),
  to_status    VARCHAR(50),
  user_id      INT,
  comment      TEXT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_al_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Finance-specific notifications (also mirrored to notifications when needed)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS finance_notifications (
  id           INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  type         VARCHAR(100) NOT NULL,
  title        VARCHAR(500) NOT NULL,
  message      TEXT,
  entity_type  VARCHAR(50),
  entity_id    INT,
  `read`       TINYINT(1) DEFAULT 0,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fn_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Finance settings (key/value)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS finance_settings (
  `key`       VARCHAR(255) NOT NULL PRIMARY KEY,
  value       JSON NOT NULL,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_fi_date        ON finance_income(income_date);
CREATE INDEX IF NOT EXISTS idx_fi_status      ON finance_income(status);
CREATE INDEX IF NOT EXISTS idx_fi_client      ON finance_income(client_id);
CREATE INDEX IF NOT EXISTS idx_fi_project     ON finance_income(project_id);
CREATE INDEX IF NOT EXISTS idx_fi_deleted     ON finance_income(deleted_at);
CREATE INDEX IF NOT EXISTS idx_fe_date        ON finance_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_fe_status      ON finance_expenses(status);
CREATE INDEX IF NOT EXISTS idx_fe_vendor      ON finance_expenses(vendor_id);
CREATE INDEX IF NOT EXISTS idx_fe_project     ON finance_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_fe_deleted     ON finance_expenses(deleted_at);
CREATE INDEX IF NOT EXISTS idx_se_staff       ON staff_expenses(staff_id);
CREATE INDEX IF NOT EXISTS idx_se_status      ON staff_expenses(status);
CREATE INDEX IF NOT EXISTS idx_se_date        ON staff_expenses(claim_date);
CREATE INDEX IF NOT EXISTS idx_ft_date        ON finance_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_ft_account     ON finance_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_ft_type        ON finance_transactions(txn_type);
CREATE INDEX IF NOT EXISTS idx_cb_date        ON cash_book(entry_date);
CREATE INDEX IF NOT EXISTS idx_cb_account     ON cash_book(account_id);
CREATE INDEX IF NOT EXISTS idx_vendors_name   ON vendors(name);
CREATE INDEX IF NOT EXISTS idx_vp_vendor      ON vendor_payments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_fn_user_read   ON finance_notifications(user_id, `read`);
CREATE INDEX IF NOT EXISTS idx_al_entity      ON approval_logs(entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Seed default categories (ignore duplicates)
-- ---------------------------------------------------------------------------

INSERT IGNORE INTO income_categories (name, icon, color, sort_order) VALUES
  ('Project Advance', 'HandCoins', '#16a34a', 1),
  ('Project Final Payment', 'BadgeCheck', '#15803d', 2),
  ('Consultation', 'MessageSquare', '#2563eb', 3),
  ('Permit Fee', 'FileCheck', '#7c3aed', 4),
  ('Interior Design', 'Sofa', '#db2777', 5),
  ('Drawing Fee', 'PenTool', '#0891b2', 6),
  ('Other Income', 'CircleDollarSign', '#64748b', 7);

INSERT IGNORE INTO expense_categories (name, icon, color, sort_order) VALUES
  ('Salary', 'Wallet', '#dc2626', 1),
  ('Rent', 'Building', '#ea580c', 2),
  ('Fuel', 'Fuel', '#ca8a04', 3),
  ('Travel', 'Plane', '#2563eb', 4),
  ('Internet', 'Wifi', '#0891b2', 5),
  ('Electricity', 'Zap', '#eab308', 6),
  ('Water', 'Droplets', '#0ea5e9', 7),
  ('Printing', 'Printer', '#6366f1', 8),
  ('Permit Charges', 'Stamp', '#7c3aed', 9),
  ('Marketing', 'Megaphone', '#ec4899', 10),
  ('Material Purchase', 'Package', '#b45309', 11),
  ('Office Supplies', 'Paperclip', '#64748b', 12),
  ('Maintenance', 'Wrench', '#78716c', 13),
  ('Subscriptions', 'Repeat', '#8b5cf6', 14),
  ('Miscellaneous', 'MoreHorizontal', '#94a3b8', 15);

INSERT IGNORE INTO finance_accounts (name, account_type, opening_balance, current_balance) VALUES
  ('Cash', 'cash', 0, 0),
  ('Petty Cash', 'petty', 0, 0),
  ('SBI', 'bank', 0, 0),
  ('HDFC', 'bank', 0, 0),
  ('ICICI', 'bank', 0, 0),
  ('Canara', 'bank', 0, 0),
  ('UPI', 'upi', 0, 0);

INSERT IGNORE INTO finance_settings (`key`, value) VALUES
  ('low_cash_threshold', '5000'),
  ('receipt_prefix', '"RCP"'),
  ('expense_prefix', '"EXP"'),
  ('claim_prefix', '"CLM"'),
  ('transfer_prefix', '"TRF"'),
  ('txn_prefix', '"TXN"');

SET FOREIGN_KEY_CHECKS = 1;

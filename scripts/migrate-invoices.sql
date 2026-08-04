-- Invoice management & office settings migration (MySQL)
-- Safe to run on existing databases — uses IF NOT EXISTS / CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS office_settings (
  `key`       VARCHAR(255) NOT NULL PRIMARY KEY,
  value       JSON NOT NULL,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoices (
  id               INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id       INT,
  invoice_number   VARCHAR(100) UNIQUE NOT NULL,
  status           VARCHAR(50)  DEFAULT 'Draft',
  invoice_date     DATE NOT NULL,
  due_date         DATE,
  client_name      VARCHAR(500) NOT NULL,
  client_address   TEXT,
  client_email     VARCHAR(255),
  client_phone     VARCHAR(50),
  client_tax_id    VARCHAR(100),
  project_name     VARCHAR(500),
  notes            TEXT,
  terms            TEXT,
  subtotal         DECIMAL(12,2) DEFAULT 0,
  tax_percent      DECIMAL(5,2)  DEFAULT 0,
  tax_amount       DECIMAL(12,2) DEFAULT 0,
  discount_percent DECIMAL(5,2)  DEFAULT 0,
  discount_amount  DECIMAL(12,2) DEFAULT 0,
  total            DECIMAL(12,2) DEFAULT 0,
  amount_paid      DECIMAL(12,2) DEFAULT 0,
  balance          DECIMAL(12,2) DEFAULT 0,
  created_by       INT,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_m_invoices_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_m_invoices_creator FOREIGN KEY (created_by) REFERENCES app_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id               INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  invoice_id       INT NOT NULL,
  description      TEXT NOT NULL,
  quantity         DECIMAL(10,2) DEFAULT 1,
  unit             VARCHAR(50)   DEFAULT 'Nos',
  unit_price       DECIMAL(12,2) DEFAULT 0,
  discount_amount  DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_percent DECIMAL(5,2)  NOT NULL DEFAULT 0,
  amount           DECIMAL(12,2) DEFAULT 0,
  sort_order       INT DEFAULT 0,
  CONSTRAINT fk_m_line_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoice_payments (
  id            INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  invoice_id    INT NOT NULL,
  amount        DECIMAL(12,2) NOT NULL,
  payment_date  DATE NOT NULL,
  method        VARCHAR(100) NOT NULL,
  notes         TEXT,
  recorded_by   INT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_m_inv_payments_invoice FOREIGN KEY (invoice_id)  REFERENCES invoices(id)   ON DELETE CASCADE,
  CONSTRAINT fk_m_inv_payments_user    FOREIGN KEY (recorded_by) REFERENCES app_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_invoices_project_id    ON invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status        ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date  ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date      ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at    ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_inv ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_inv   ON invoice_payments(invoice_id);

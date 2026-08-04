-- Per-line discount support (run via: npm run db:migrate-invoice-discounts)
-- Final Rate = unit_price - discount_amount
-- Amount = Final Rate x quantity

-- Prefer the .mjs migrator which checks information_schema first.
-- Manual fallback (MySQL 8.0.29+):

-- ALTER TABLE invoice_line_items
--   ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER unit_price,
--   ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER discount_amount;

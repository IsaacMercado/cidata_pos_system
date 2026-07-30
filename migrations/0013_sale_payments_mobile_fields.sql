-- ============================================================
-- POS System - Pago móvil: fecha, referencia (ya existe), teléfono
-- Plus currency + amount_usd para soporte multimoneda en payments
-- ============================================================

ALTER TABLE sale_payments ADD COLUMN payment_date TEXT;
ALTER TABLE sale_payments ADD COLUMN phone TEXT;
ALTER TABLE sale_payments ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE sale_payments ADD COLUMN amount_usd REAL NOT NULL DEFAULT 0;

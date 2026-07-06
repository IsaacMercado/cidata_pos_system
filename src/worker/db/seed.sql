-- ============================================================
-- Seed data for POS system
-- ============================================================

-- Payment methods
INSERT OR IGNORE INTO payment_methods (code, name) VALUES
  ('cash', 'Efectivo'),
  ('card', 'Tarjeta de Débito/Crédito'),
  ('transfer', 'Transferencia Bancaria'),
  ('mobile', 'Pago Móvil');

-- Default user
INSERT OR IGNORE INTO users (username, name, pin, role) VALUES
  ('admin', 'Administrador', '1234', 'admin'),
  ('cashier1', 'Cajero 1', '0000', 'cashier');

-- Categories
INSERT OR IGNORE INTO categories (name, description) VALUES
  ('Bebidas', 'Bebidas y refrescos'),
  ('Alimentos', 'Alimentos preparados y empaquetados'),
  ('Lácteos', 'Productos lácteos'),
  ('Limpieza', 'Productos de limpieza');

-- Sample products
INSERT OR IGNORE INTO products (code, barcode, name, category_id, price, cost, tax_rate, unit, min_stock, current_stock) VALUES
  ('PROD-001', '789100001', 'Refresco Cola 355ml', 1, 1.50, 0.80, 0.16, 'unit', 10, 50),
  ('PROD-002', '789100002', 'Agua Mineral 500ml', 1, 1.00, 0.50, 0.08, 'unit', 20, 100),
  ('PROD-003', '789100003', 'Pan de Molde', 2, 2.50, 1.20, 0.08, 'unit', 5, 15),
  ('PROD-004', '789100004', 'Leche Entera 1L', 3, 1.80, 1.00, 0.08, 'unit', 10, 30),
  ('PROD-005', '789100005', 'Detergente Líquido 1L', 4, 3.50, 2.00, 0.16, 'unit', 5, 20),
  ('PROD-006', '789100006', 'Queso Amarillo 500g', 3, 4.00, 2.50, 0.16, 'unit', 5, 12),
  ('PROD-007', '789100007', 'Jugo de Naranja 1L', 1, 2.00, 1.10, 0.08, 'unit', 10, 25),
  ('PROD-008', '789100008', 'Arroz 1kg', 2, 1.20, 0.70, 0.08, 'unit', 20, 80);

-- Sample customer
INSERT OR IGNORE INTO customers (code, name, phone, document_type, document_number) VALUES
  ('CLT-001', 'Cliente General', NULL, 'CI', '00000000'),
  ('CLT-002', 'Juan Pérez', '04121234567', 'CI', '12345678');

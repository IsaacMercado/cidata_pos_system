-- ============================================================
-- Seed data for POS system
-- ============================================================

-- Payment methods
INSERT OR IGNORE INTO payment_methods (code, name) VALUES
  ('cash', 'Efectivo'),
  ('card', 'Tarjeta de Débito/Crédito'),
  ('transfer', 'Transferencia Bancaria'),
  ('mobile', 'Pago Móvil');

-- Default users (with email + password_hash for web auth, and pin_hash for offline PIN login)
-- Web passwords: admin/admin, cashier1/0000
-- PINs (offline): admin=1234, cashier1=0000  (hashes generados con PBKDF2-SHA256, 10000 iter)
INSERT OR IGNORE INTO users (username, name, pin, pin_hash, role, email, password_hash, is_superuser) VALUES
  ('admin', 'Administrador', '', 'pbkdf2_sha256$10000$a1b2c3d4e5f600112233445566778899$fbbabfff68ffe2ee542cef4559eb90855842dfdf8653b935d230f5f05ab44918', 'admin', 'admin@pos.local', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 1),
  ('cashier1', 'Cajero 1', '', 'pbkdf2_sha256$10000$b2c3d4e5f600112233445566778899aa$a0c33d85cae12e5e9cd600661fcbd63de2215fb7b3daa777d8621830a8353016', 'cashier', 'cashier1@pos.local', '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0', 0);

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

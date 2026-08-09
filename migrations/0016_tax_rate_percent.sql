-- Tax rates are percentages in the UI and calculation code (16 means 16%).
-- Normalize the legacy seed values that were stored as fractions (0.16 = 16%).
UPDATE products
SET tax_rate = tax_rate * 100
WHERE tax_rate IN (0.08, 0.16);

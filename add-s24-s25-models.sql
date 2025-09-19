-- Add missing S24/S25 models to the reference tables
-- This fixes the S24/S25 PLUS/ULTRA parsing issues

-- Add S24 models
INSERT INTO sku_model_reference (brand_id, model_name, model_code, sku_patterns, device_type, description) VALUES
(2, 'Galaxy S24', 'S24', ARRAY['S24'], 'PHONE', 'Galaxy S24 series'),
(2, 'Galaxy S24 Plus', 'S24-PLUS', ARRAY['S24-PLUS', 'S24PLUS'], 'PHONE', 'Galaxy S24 Plus'),
(2, 'Galaxy S24 Ultra', 'S24-ULTRA', ARRAY['S24-ULTRA', 'S24ULTRA'], 'PHONE', 'Galaxy S24 Ultra'),

-- Add S25 models
(2, 'Galaxy S25', 'S25', ARRAY['S25'], 'PHONE', 'Galaxy S25 series'),
(2, 'Galaxy S25 Plus', 'S25-PLUS', ARRAY['S25-PLUS', 'S25PLUS'], 'PHONE', 'Galaxy S25 Plus'),
(2, 'Galaxy S25 Ultra', 'S25-ULTRA', ARRAY['S25-ULTRA', 'S25ULTRA'], 'PHONE', 'Galaxy S25 Ultra'),

-- Add S25 Edge model
(2, 'Galaxy S25 Edge', 'S25-EDGE', ARRAY['S25-EDGE', 'S25EDGE'], 'PHONE', 'Galaxy S25 Edge')

ON CONFLICT (model_code) DO NOTHING;

-- Update brand patterns to include S24/S25
UPDATE sku_brand_reference 
SET sku_patterns = ARRAY['SAMSUNG', 'GALAXY', 'S25', 'S24', 'S23', 'S22', 'S21', 'S20', 'S10', 'NOTE', 'TAB-', 'WATCH-', 'ZFLIP', 'FOLD']
WHERE brand_name = 'SAMSUNG';

-- Update device type patterns to include S24/S25
UPDATE sku_device_type_reference 
SET sku_patterns = ARRAY['IP-', 'S25', 'S24', 'S23', 'S22', 'S21', 'S20', 'S10', 'NOTE', 'PIXEL', 'ZFLIP', 'FOLD']
WHERE device_type = 'PHONE';




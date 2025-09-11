-- Create normalization_tags table for combined postfix and tag-based normalization
CREATE TABLE IF NOT EXISTS normalization_tags (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,           -- 'model', 'capacity', 'color', 'carrier', 'postfix'
    input_value VARCHAR(255) NOT NULL,       -- Original value from device
    normalized_value VARCHAR(255) NOT NULL,  -- Standardized value
    tags TEXT[] NOT NULL,                    -- Array of tags for matching
    is_postfix BOOLEAN DEFAULT FALSE,        -- Is this a postfix (for filtering)
    is_active BOOLEAN DEFAULT TRUE,          -- Is this mapping active
    priority INTEGER DEFAULT 0,              -- Priority for matching (higher = more specific)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_normalization_tags_category ON normalization_tags(category);
CREATE INDEX IF NOT EXISTS idx_normalization_tags_input ON normalization_tags(input_value);
CREATE INDEX IF NOT EXISTS idx_normalization_tags_tags ON normalization_tags USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_normalization_tags_postfix ON normalization_tags(is_postfix) WHERE is_postfix = true;

-- Clear existing data
DELETE FROM normalization_tags;

-- MODEL NORMALIZATION (based on actual SKU data)
INSERT INTO normalization_tags (category, input_value, normalized_value, tags, priority) VALUES
-- S22 Ultra variations
('model', 'Galaxy S22 Ultra 5G Duos', 'S22_ULTRA', ARRAY['S22', 'ULTRA', 'Galaxy S22 Ultra 5G Duos'], 100),
('model', 'Galaxy S22 Ultra', 'S22_ULTRA', ARRAY['S22', 'ULTRA', 'Galaxy S22 Ultra'], 95),
('model', 'S22 Ultra', 'S22_ULTRA', ARRAY['S22', 'ULTRA'], 90),
('model', 'Galaxy S22', 'S22', ARRAY['S22', 'Galaxy S22'], 85),
('model', 'S22', 'S22', ARRAY['S22'], 80),

-- S23 variations (if they exist)
('model', 'Galaxy S23 Ultra 5G Duos', 'S23_ULTRA', ARRAY['S23', 'ULTRA', 'Galaxy S23 Ultra 5G Duos'], 100),
('model', 'Galaxy S23 Ultra', 'S23_ULTRA', ARRAY['S23', 'ULTRA', 'Galaxy S23 Ultra'], 95),
('model', 'S23 Ultra', 'S23_ULTRA', ARRAY['S23', 'ULTRA'], 90),
('model', 'Galaxy S23', 'S23', ARRAY['S23', 'Galaxy S23'], 85),
('model', 'S23', 'S23', ARRAY['S23'], 80),

-- Fold3 variations
('model', 'Galaxy Z Fold3 Duos', 'FOLD3', ARRAY['FOLD3', 'Galaxy Z Fold3 Duos'], 100),
('model', 'Galaxy Z Fold3', 'FOLD3', ARRAY['FOLD3', 'Galaxy Z Fold3'], 95),
('model', 'Galaxy Fold3', 'FOLD3', ARRAY['FOLD3', 'Galaxy Fold3'], 90),
('model', 'Fold3', 'FOLD3', ARRAY['FOLD3'], 85);

-- CAPACITY NORMALIZATION (based on actual SKU data)
INSERT INTO normalization_tags (category, input_value, normalized_value, tags, priority) VALUES
-- 512GB variations
('capacity', '512GB', '512', ARRAY['512', '512GB'], 100),
('capacity', '512 GB', '512', ARRAY['512', '512GB'], 100),
('capacity', '512G', '512', ARRAY['512', '512G'], 95),
('capacity', '512', '512', ARRAY['512'], 90),

-- 256GB variations
('capacity', '256GB', '256', ARRAY['256', '256GB'], 100),
('capacity', '256 GB', '256', ARRAY['256', '256GB'], 100),
('capacity', '256G', '256', ARRAY['256', '256G'], 95),
('capacity', '256', '256', ARRAY['256'], 90),

-- 128GB variations
('capacity', '128GB', '128', ARRAY['128', '128GB'], 100),
('capacity', '128 GB', '128', ARRAY['128', '128GB'], 100),
('capacity', '128G', '128', ARRAY['128', '128G'], 95),
('capacity', '128', '128', ARRAY['128'], 90);

-- COLOR NORMALIZATION (based on actual SKU data)
INSERT INTO normalization_tags (category, input_value, normalized_value, tags, priority) VALUES
-- Burgundy variations
('color', 'Burgundy', 'BURGUNDY', ARRAY['BURGUNDY', 'Burgundy'], 100),

-- Black variations
('color', 'Phantom Black', 'BLK', ARRAY['BLK', 'BLACK', 'Phantom Black'], 100),
('color', 'Black', 'BLK', ARRAY['BLK', 'BLACK'], 95),
('color', 'BLK', 'BLK', ARRAY['BLK'], 90),

-- White variations
('color', 'Phantom White', 'WHT', ARRAY['WHT', 'WHITE', 'Phantom White'], 100),
('color', 'White', 'WHT', ARRAY['WHT', 'WHITE'], 95),
('color', 'WHT', 'WHT', ARRAY['WHT'], 90),

-- Pink variations
('color', 'Pink', 'PINK', ARRAY['PINK', 'Pink'], 100),
('color', 'PINK', 'PINK', ARRAY['PINK'], 95),

-- Green variations (common in Samsung)
('color', 'Phantom Green', 'GREEN', ARRAY['GREEN', 'Phantom Green'], 100),
('color', 'Green', 'GREEN', ARRAY['GREEN'], 95),

-- Silver variations
('color', 'Phantom Silver', 'SLV', ARRAY['SLV', 'SILVER', 'Phantom Silver'], 100),
('color', 'Silver', 'SLV', ARRAY['SLV', 'SILVER'], 95),
('color', 'SLV', 'SLV', ARRAY['SLV'], 90);

-- CARRIER NORMALIZATION (based on actual SKU data)
INSERT INTO normalization_tags (category, input_value, normalized_value, tags, priority) VALUES
-- Verizon variations
('carrier', 'Verizon', 'VERIZON', ARRAY['VERIZON', 'Verizon'], 100),
('carrier', 'UNLOCKED', 'UNLOCKED', ARRAY['UNLOCKED'], 100),

-- Postfix variations
('postfix', 'VG', 'VG', ARRAY['VG'], 100),

-- T-Mobile variations
('carrier', 'T-Mobile', 'TMO', ARRAY['TMO', 'T-MOBILE', 'T-Mobile'], 100),
('carrier', 'TMO', 'TMO', ARRAY['TMO'], 95),

-- AT&T variations
('carrier', 'AT&T', 'ATT', ARRAY['ATT', 'AT&T'], 100),
('carrier', 'ATT', 'ATT', ARRAY['ATT'], 95),

-- Unlocked variations
('carrier', 'Unlocked', 'UNLOCKED', ARRAY['UNLOCKED', 'Unlocked'], 100),
('carrier', 'UNLOCKED', 'UNLOCKED', ARRAY['UNLOCKED'], 95);

-- POSTFIX FILTERING (is_postfix = true) - based on actual SKU data
INSERT INTO normalization_tags (category, input_value, normalized_value, tags, is_postfix, priority) VALUES
-- Carrier postfixes (for filtering out locked devices)
('postfix', 'VG', 'VERIZON_LOCKED', ARRAY['VG', 'VERIZON_LOCKED'], true, 100),
('postfix', 'TMO', 'TMOBILE_LOCKED', ARRAY['TMO', 'TMOBILE_LOCKED'], true, 100),
('postfix', 'ATT', 'ATT_LOCKED', ARRAY['ATT', 'ATT_LOCKED'], true, 100),

-- Grade postfixes (for filtering out lower grade devices)
('postfix', 'VG', 'GRADE_B', ARRAY['VG', 'GRADE_B'], true, 90),
('postfix', 'UV', 'GRADE_B', ARRAY['UV', 'GRADE_B'], true, 90),
('postfix', 'ACCEPTABLE', 'GRADE_C', ARRAY['ACCEPTABLE', 'GRADE_C'], true, 80),

-- Premium postfixes (keep these)
('postfix', 'UL', 'GRADE_A', ARRAY['UL', 'GRADE_A'], true, 110),
('postfix', 'LN', 'GRADE_A', ARRAY['LN', 'GRADE_A'], true, 110),
('postfix', 'NEW', 'NEW', ARRAY['NEW'], true, 120);

-- BRAND NORMALIZATION (based on actual SKU data)
INSERT INTO normalization_tags (category, input_value, normalized_value, tags, priority) VALUES
('brand', 'Samsung', 'SAMSUNG', ARRAY['SAMSUNG', 'Samsung'], 100),
('brand', 'SAMSUNG', 'SAMSUNG', ARRAY['SAMSUNG'], 95);

-- DEVICE TYPE NORMALIZATION (based on actual SKU data)
INSERT INTO normalization_tags (category, input_value, normalized_value, tags, priority) VALUES
('device_type', 'PHONE', 'PHONE', ARRAY['PHONE'], 100),
('device_type', 'TABLET', 'TABLET', ARRAY['TABLET'], 100),
('device_type', 'WATCH', 'WATCH', ARRAY['WATCH'], 100);

-- Show the created data
SELECT 
    category,
    input_value,
    normalized_value,
    tags,
    is_postfix,
    priority
FROM normalization_tags
ORDER BY category, priority DESC;

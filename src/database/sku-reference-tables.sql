-- ========================================
-- SKU REFERENCE TABLES FOR PARSING SUPPORT
-- ========================================
-- These tables provide reference data to support SKU master generation
-- and make it easier to identify and maintain SKU parsing logic

-- Brand Reference Table
CREATE TABLE IF NOT EXISTS sku_brand_reference (
    id SERIAL PRIMARY KEY,
    brand_name VARCHAR(50) NOT NULL,
    brand_code VARCHAR(20) NOT NULL UNIQUE,
    sku_patterns TEXT[] NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Model Reference Table
CREATE TABLE IF NOT EXISTS sku_model_reference (
    id SERIAL PRIMARY KEY,
    brand_id INTEGER REFERENCES sku_brand_reference(id),
    model_name VARCHAR(100) NOT NULL,
    model_code VARCHAR(50) NOT NULL UNIQUE,
    sku_patterns TEXT[] NOT NULL,
    device_type VARCHAR(20) DEFAULT 'PHONE',
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Color Reference Table
CREATE TABLE IF NOT EXISTS sku_color_reference (
    id SERIAL PRIMARY KEY,
    color_name VARCHAR(50) NOT NULL,
    color_code VARCHAR(10) NOT NULL UNIQUE,
    sku_patterns TEXT[] NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Carrier Reference Table
CREATE TABLE IF NOT EXISTS sku_carrier_reference (
    id SERIAL PRIMARY KEY,
    carrier_name VARCHAR(50) NOT NULL,
    carrier_code VARCHAR(20) NOT NULL UNIQUE,
    sku_patterns TEXT[] NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Capacity Reference Table
CREATE TABLE IF NOT EXISTS sku_capacity_reference (
    id SERIAL PRIMARY KEY,
    capacity_value VARCHAR(20) NOT NULL,
    capacity_code VARCHAR(10) NOT NULL UNIQUE,
    sku_patterns TEXT[] NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Postfix Reference Table (Condition/Grade indicators)
CREATE TABLE IF NOT EXISTS sku_postfix_reference (
    id SERIAL PRIMARY KEY,
    postfix_name VARCHAR(50) NOT NULL,
    postfix_code VARCHAR(20) NOT NULL UNIQUE,
    sku_patterns TEXT[] NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Device Type Reference Table
CREATE TABLE IF NOT EXISTS sku_device_type_reference (
    id SERIAL PRIMARY KEY,
    device_type VARCHAR(20) NOT NULL UNIQUE,
    sku_patterns TEXT[] NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- INSERT REFERENCE DATA
-- ========================================

-- Brand Reference Data
INSERT INTO sku_brand_reference (brand_name, brand_code, sku_patterns, description) VALUES
('APPLE', 'APPLE', ARRAY['IP-', 'IPHONE', 'IPAD', 'MAC', 'AIRPODS', 'WATCH-'], 'Apple Inc. devices'),
('SAMSUNG', 'SAMSUNG', ARRAY['SAMSUNG', 'GALAXY', 'S23', 'S22', 'S21', 'S20', 'S10', 'NOTE', 'TAB-', 'WATCH-', 'ZFLIP', 'FOLD'], 'Samsung Electronics devices'),
('GOOGLE', 'GOOGLE', ARRAY['PIXEL', 'GOOGLE', 'NEXUS'], 'Google devices'),
('ONEPLUS', 'ONEPLUS', ARRAY['ONEPLUS', 'ONE-'], 'OnePlus devices'),
('XIAOMI', 'XIAOMI', ARRAY['XIAOMI', 'MI-', 'REDMI', 'POCO'], 'Xiaomi devices'),
('HUAWEI', 'HUAWEI', ARRAY['HUAWEI', 'HONOR'], 'Huawei devices')
ON CONFLICT (brand_code) DO NOTHING;

-- Model Reference Data
INSERT INTO sku_model_reference (brand_id, model_name, model_code, sku_patterns, device_type, description) VALUES
-- Apple Models
(1, 'iPhone 13', 'IP-13', ARRAY['IP-13', 'IPHONE13'], 'PHONE', 'iPhone 13 series'),
(1, 'iPhone 14', 'IP-14', ARRAY['IP-14', 'IPHONE14'], 'PHONE', 'iPhone 14 series'),
(1, 'iPhone 15', 'IP-15', ARRAY['IP-15', 'IPHONE15'], 'PHONE', 'iPhone 15 series'),
(1, 'iPad', 'IPAD', ARRAY['IPAD'], 'TABLET', 'iPad series'),
(1, 'iPad Pro', 'IPAD-PRO', ARRAY['IPAD-PRO', 'IPADPRO'], 'TABLET', 'iPad Pro series'),
(1, 'Apple Watch', 'WATCH-', ARRAY['WATCH-'], 'WATCH', 'Apple Watch series'),

-- Samsung Models
(2, 'Galaxy S23', 'S23', ARRAY['S23'], 'PHONE', 'Galaxy S23 series'),
(2, 'Galaxy S23 Ultra', 'S23-ULTRA', ARRAY['S23-ULTRA', 'S23ULTRA'], 'PHONE', 'Galaxy S23 Ultra'),
(2, 'Galaxy S22', 'S22', ARRAY['S22'], 'PHONE', 'Galaxy S22 series'),
(2, 'Galaxy S21', 'S21', ARRAY['S21'], 'PHONE', 'Galaxy S21 series'),
(2, 'Galaxy S20', 'S20', ARRAY['S20'], 'PHONE', 'Galaxy S20 series'),
(2, 'Galaxy S10', 'S10', ARRAY['S10'], 'PHONE', 'Galaxy S10 series'),
(2, 'Galaxy Note', 'NOTE-', ARRAY['NOTE-'], 'PHONE', 'Galaxy Note series'),
(2, 'Galaxy Z Flip', 'ZFLIP', ARRAY['ZFLIP'], 'PHONE', 'Galaxy Z Flip series'),
(2, 'Galaxy Z Fold', 'FOLD', ARRAY['FOLD'], 'PHONE', 'Galaxy Z Fold series'),
(2, 'Galaxy Tab', 'TAB-', ARRAY['TAB-'], 'TABLET', 'Galaxy Tab series'),
(2, 'Galaxy Watch', 'WATCH-', ARRAY['WATCH-'], 'WATCH', 'Galaxy Watch series'),

-- Google Models
(3, 'Pixel 7', 'PIXEL-7', ARRAY['PIXEL-7', 'PIXEL7'], 'PHONE', 'Pixel 7 series'),
(3, 'Pixel 8', 'PIXEL-8', ARRAY['PIXEL-8', 'PIXEL8'], 'PHONE', 'Pixel 8 series'),
(3, 'Pixel Watch', 'PIXEL-WATCH', ARRAY['PIXEL-WATCH'], 'WATCH', 'Pixel Watch series')
ON CONFLICT (model_code) DO NOTHING;

-- Color Reference Data
INSERT INTO sku_color_reference (color_name, color_code, sku_patterns, description) VALUES
('BLACK', 'BLK', ARRAY['BLK', 'BLACK'], 'Black color'),
('WHITE', 'WHT', ARRAY['WHT', 'WHITE'], 'White color'),
('SILVER', 'SLV', ARRAY['SLV', 'SILVER'], 'Silver color'),
('GOLD', 'GLD', ARRAY['GLD', 'GOLD'], 'Gold color'),
('PINK', 'PNK', ARRAY['PINK', 'ROSE'], 'Pink color'),
('BLUE', 'BLU', ARRAY['BLU', 'BLUE'], 'Blue color'),
('GREEN', 'GRN', ARRAY['GRN', 'GREEN'], 'Green color'),
('RED', 'RED', ARRAY['RED'], 'Red color'),
('PURPLE', 'PUR', ARRAY['PUR', 'PURPLE'], 'Purple color'),
('YELLOW', 'YLW', ARRAY['YLW', 'YELLOW'], 'Yellow color'),
('ORANGE', 'ORG', ARRAY['ORG', 'ORANGE'], 'Orange color'),
('GRAY', 'GRY', ARRAY['GRY', 'GRAY', 'GREY'], 'Gray color'),
('CREAM', 'CREAM', ARRAY['CREAM', 'BEIGE'], 'Cream color'),
('BURGUNDY', 'BURG', ARRAY['BURGUNDY', 'BURG'], 'Burgundy color')
ON CONFLICT (color_code) DO NOTHING;

-- Carrier Reference Data
INSERT INTO sku_carrier_reference (carrier_name, carrier_code, sku_patterns, description) VALUES
('UNLOCKED', 'UNLOCKED', ARRAY['UNLOCKED', 'UNLOCK'], 'Unlocked device'),
('VERIZON', 'VERIZON', ARRAY['VERIZON', 'VZW', 'VRZ'], 'Verizon carrier'),
('AT&T', 'ATT', ARRAY['ATT', 'AT&T'], 'AT&T carrier'),
('T-MOBILE', 'T-MOBILE', ARRAY['TMOBILE', 'T-MOBILE', 'TMO', 'T-MO'], 'T-Mobile carrier'),
('SPRINT', 'SPRINT', ARRAY['SPRINT', 'SPR'], 'Sprint carrier'),
('WIFI', 'WIFI', ARRAY['WIFI', 'WI-FI'], 'WiFi only device'),
('4G', '4G', ARRAY['4G', 'LTE'], '4G/LTE device'),
('5G', '5G', ARRAY['5G'], '5G device')
ON CONFLICT (carrier_code) DO NOTHING;

-- Capacity Reference Data
INSERT INTO sku_capacity_reference (capacity_value, capacity_code, sku_patterns, description) VALUES
('64GB', '64', ARRAY['64', '64GB'], '64GB storage'),
('128GB', '128', ARRAY['128', '128GB'], '128GB storage'),
('256GB', '256', ARRAY['256', '256GB'], '256GB storage'),
('512GB', '512', ARRAY['512', '512GB'], '512GB storage'),
('1TB', '1TB', ARRAY['1TB', '1T'], '1TB storage'),
('32GB', '32', ARRAY['32', '32GB'], '32GB storage'),
('16GB', '16', ARRAY['16', '16GB'], '16GB storage'),
('8GB', '8', ARRAY['8', '8GB'], '8GB storage'),
('4GB', '4', ARRAY['4', '4GB'], '4GB storage'),
('2GB', '2', ARRAY['2', '2GB'], '2GB storage')
ON CONFLICT (capacity_code) DO NOTHING;

-- Postfix Reference Data (Condition/Grade indicators)
INSERT INTO sku_postfix_reference (postfix_name, postfix_code, sku_patterns, description) VALUES
('Very Good', 'VG', ARRAY['VG'], 'Very Good condition'),
('New', 'NEW', ARRAY['NEW'], 'New condition'),
('Acceptable', 'ACCEPTABLE', ARRAY['ACCEPTABLE'], 'Acceptable condition'),
('Unlocked', 'UL', ARRAY['UL'], 'Unlocked condition'),
('Like New', 'LN', ARRAY['LN'], 'Like New condition'),
('Open Box', 'OPENBOX', ARRAY['OPENBOX'], 'Open Box condition'),
('Used', 'USED', ARRAY['USED'], 'Used condition'),
('Refurbished', 'REFURB', ARRAY['REFURB'], 'Refurbished condition')
ON CONFLICT (postfix_code) DO NOTHING;

-- Device Type Reference Data
INSERT INTO sku_device_type_reference (device_type, sku_patterns, description) VALUES
('PHONE', ARRAY['IP-', 'S23', 'S22', 'S21', 'S20', 'S10', 'NOTE', 'PIXEL', 'ZFLIP', 'FOLD'], 'Smartphone devices'),
('TABLET', ARRAY['IPAD', 'TAB-'], 'Tablet devices'),
('WATCH', ARRAY['WATCH-', 'AW'], 'Smartwatch devices'),
('DESKTOP', ARRAY['MAC', 'IMAC'], 'Desktop/laptop devices'),
('AUDIO', ARRAY['AIRPODS'], 'Audio devices')
ON CONFLICT (device_type) DO NOTHING;

-- ========================================
-- CREATE INDEXES FOR PERFORMANCE
-- ========================================

CREATE INDEX IF NOT EXISTS idx_sku_brand_reference_code ON sku_brand_reference(brand_code);
CREATE INDEX IF NOT EXISTS idx_sku_brand_reference_active ON sku_brand_reference(is_active);

CREATE INDEX IF NOT EXISTS idx_sku_model_reference_brand ON sku_model_reference(brand_id);
CREATE INDEX IF NOT EXISTS idx_sku_model_reference_code ON sku_model_reference(model_code);
CREATE INDEX IF NOT EXISTS idx_sku_model_reference_active ON sku_model_reference(is_active);

CREATE INDEX IF NOT EXISTS idx_sku_color_reference_code ON sku_color_reference(color_code);
CREATE INDEX IF NOT EXISTS idx_sku_color_reference_active ON sku_color_reference(is_active);

CREATE INDEX IF NOT EXISTS idx_sku_carrier_reference_code ON sku_carrier_reference(carrier_code);
CREATE INDEX IF NOT EXISTS idx_sku_carrier_reference_active ON sku_carrier_reference(is_active);

CREATE INDEX IF NOT EXISTS idx_sku_capacity_reference_code ON sku_capacity_reference(capacity_code);
CREATE INDEX IF NOT EXISTS idx_sku_capacity_reference_active ON sku_capacity_reference(is_active);

CREATE INDEX IF NOT EXISTS idx_sku_postfix_reference_code ON sku_postfix_reference(postfix_code);
CREATE INDEX IF NOT EXISTS idx_sku_postfix_reference_active ON sku_postfix_reference(is_active);

CREATE INDEX IF NOT EXISTS idx_sku_device_type_reference_type ON sku_device_type_reference(device_type);
CREATE INDEX IF NOT EXISTS idx_sku_device_type_reference_active ON sku_device_type_reference(is_active);

-- ========================================
-- CREATE VIEWS FOR EASY QUERYING
-- ========================================

-- Complete SKU Reference View
CREATE OR REPLACE VIEW sku_reference_complete AS
SELECT 
    b.brand_name,
    b.brand_code,
    b.sku_patterns as brand_patterns,
    m.model_name,
    m.model_code,
    m.sku_patterns as model_patterns,
    m.device_type,
    c.color_name,
    c.color_code,
    c.sku_patterns as color_patterns,
    cr.carrier_name,
    cr.carrier_code,
    cr.sku_patterns as carrier_patterns,
    cap.capacity_value,
    cap.capacity_code,
    cap.sku_patterns as capacity_patterns,
    p.postfix_name,
    p.postfix_code,
    p.sku_patterns as postfix_patterns,
    dt.device_type as device_type_name,
    dt.sku_patterns as device_type_patterns
FROM sku_brand_reference b
LEFT JOIN sku_model_reference m ON b.id = m.brand_id
LEFT JOIN sku_color_reference c ON true
LEFT JOIN sku_carrier_reference cr ON true
LEFT JOIN sku_capacity_reference cap ON true
LEFT JOIN sku_postfix_reference p ON true
LEFT JOIN sku_device_type_reference dt ON m.device_type = dt.device_type
WHERE b.is_active = true
AND (m.id IS NULL OR m.is_active = true)
AND c.is_active = true
AND cr.is_active = true
AND cap.is_active = true
AND p.is_active = true
AND dt.is_active = true;

-- SKU Pattern Matching View
CREATE OR REPLACE VIEW sku_pattern_matching AS
SELECT 
    'BRAND' as pattern_type,
    brand_name as name,
    brand_code as code,
    unnest(sku_patterns) as pattern
FROM sku_brand_reference
WHERE is_active = true

UNION ALL

SELECT 
    'MODEL' as pattern_type,
    model_name as name,
    model_code as code,
    unnest(sku_patterns) as pattern
FROM sku_model_reference
WHERE is_active = true

UNION ALL

SELECT 
    'COLOR' as pattern_type,
    color_name as name,
    color_code as code,
    unnest(sku_patterns) as pattern
FROM sku_color_reference
WHERE is_active = true

UNION ALL

SELECT 
    'CARRIER' as pattern_type,
    carrier_name as name,
    carrier_code as code,
    unnest(sku_patterns) as pattern
FROM sku_carrier_reference
WHERE is_active = true

UNION ALL

SELECT 
    'CAPACITY' as pattern_type,
    capacity_value as name,
    capacity_code as code,
    unnest(sku_patterns) as pattern
FROM sku_capacity_reference
WHERE is_active = true

UNION ALL

SELECT 
    'POSTFIX' as pattern_type,
    postfix_name as name,
    postfix_code as code,
    unnest(sku_patterns) as pattern
FROM sku_postfix_reference
WHERE is_active = true

UNION ALL

SELECT 
    'DEVICE_TYPE' as pattern_type,
    device_type as name,
    device_type as code,
    unnest(sku_patterns) as pattern
FROM sku_device_type_reference
WHERE is_active = true;

-- ========================================
-- HELPER FUNCTIONS
-- ========================================

-- Function to get brand from SKU
CREATE OR REPLACE FUNCTION get_brand_from_sku(sku_code TEXT)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    SELECT brand_name INTO result
    FROM sku_brand_reference
    WHERE is_active = true
    AND EXISTS (
        SELECT 1 FROM unnest(sku_patterns) as pattern
        WHERE UPPER(sku_code) LIKE '%' || UPPER(pattern) || '%'
    )
    ORDER BY (
        SELECT MAX(LENGTH(pattern)) 
        FROM unnest(sku_patterns) as pattern
        WHERE UPPER(sku_code) LIKE '%' || UPPER(pattern) || '%'
    ) DESC
    LIMIT 1;
    
    RETURN COALESCE(result, '');
END;
$$ LANGUAGE plpgsql;

-- Function to get model from SKU
CREATE OR REPLACE FUNCTION get_model_from_sku(sku_code TEXT, brand_name_param TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    SELECT m.model_name INTO result
    FROM sku_model_reference m
    JOIN sku_brand_reference b ON m.brand_id = b.id
    WHERE m.is_active = true
    AND (brand_name_param IS NULL OR b.brand_name = brand_name_param)
    AND EXISTS (
        SELECT 1 FROM unnest(m.sku_patterns) as pattern
        WHERE UPPER(sku_code) LIKE '%' || UPPER(pattern) || '%'
    )
    ORDER BY (
        SELECT MAX(LENGTH(pattern)) 
        FROM unnest(m.sku_patterns) as pattern
        WHERE UPPER(sku_code) LIKE '%' || UPPER(pattern) || '%'
    ) DESC
    LIMIT 1;
    
    RETURN COALESCE(result, '');
END;
$$ LANGUAGE plpgsql;

-- Function to get color from SKU
CREATE OR REPLACE FUNCTION get_color_from_sku(sku_code TEXT)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    SELECT color_name INTO result
    FROM sku_color_reference
    WHERE is_active = true
    AND EXISTS (
        SELECT 1 FROM unnest(sku_patterns) as pattern
        WHERE UPPER(sku_code) LIKE '%' || UPPER(pattern) || '%'
    )
    ORDER BY (
        SELECT MAX(LENGTH(pattern)) 
        FROM unnest(sku_patterns) as pattern
        WHERE UPPER(sku_code) LIKE '%' || UPPER(pattern) || '%'
    ) DESC
    LIMIT 1;
    
    RETURN COALESCE(result, '');
END;
$$ LANGUAGE plpgsql;

-- Function to get carrier from SKU
CREATE OR REPLACE FUNCTION get_carrier_from_sku(sku_code TEXT)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    SELECT carrier_name INTO result
    FROM sku_carrier_reference
    WHERE is_active = true
    AND EXISTS (
        SELECT 1 FROM unnest(sku_patterns) as pattern
        WHERE UPPER(sku_code) LIKE '%' || UPPER(pattern) || '%'
    )
    ORDER BY (
        SELECT MAX(LENGTH(pattern)) 
        FROM unnest(sku_patterns) as pattern
        WHERE UPPER(sku_code) LIKE '%' || UPPER(pattern) || '%'
    ) DESC
    LIMIT 1;
    
    RETURN COALESCE(result, '');
END;
$$ LANGUAGE plpgsql;

-- Function to get capacity from SKU
CREATE OR REPLACE FUNCTION get_capacity_from_sku(sku_code TEXT)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    SELECT capacity_value INTO result
    FROM sku_capacity_reference
    WHERE is_active = true
    AND EXISTS (
        SELECT 1 FROM unnest(sku_patterns) as pattern
        WHERE UPPER(sku_code) LIKE '%' || UPPER(pattern) || '%'
    )
    ORDER BY (
        SELECT MAX(LENGTH(pattern)) 
        FROM unnest(sku_patterns) as pattern
        WHERE UPPER(sku_code) LIKE '%' || UPPER(pattern) || '%'
    ) DESC
    LIMIT 1;
    
    RETURN COALESCE(result, '');
END;
$$ LANGUAGE plpgsql;

-- Function to get postfix from SKU
CREATE OR REPLACE FUNCTION get_postfix_from_sku(sku_code TEXT)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    SELECT postfix_name INTO result
    FROM sku_postfix_reference
    WHERE is_active = true
    AND EXISTS (
        SELECT 1 FROM unnest(sku_patterns) as pattern
        WHERE UPPER(sku_code) LIKE '%' || UPPER(pattern) || '%'
    )
    ORDER BY (
        SELECT MAX(LENGTH(pattern)) 
        FROM unnest(sku_patterns) as pattern
        WHERE UPPER(sku_code) LIKE '%' || UPPER(pattern) || '%'
    ) DESC
    LIMIT 1;
    
    RETURN COALESCE(result, '');
END;
$$ LANGUAGE plpgsql;

-- Function to get device type from SKU
CREATE OR REPLACE FUNCTION get_device_type_from_sku(sku_code TEXT)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    SELECT device_type INTO result
    FROM sku_device_type_reference
    WHERE is_active = true
    AND EXISTS (
        SELECT 1 FROM unnest(sku_patterns) as pattern
        WHERE UPPER(sku_code) LIKE '%' || UPPER(pattern) || '%'
    )
    ORDER BY (
        SELECT MAX(LENGTH(pattern)) 
        FROM unnest(sku_patterns) as pattern
        WHERE UPPER(sku_code) LIKE '%' || UPPER(pattern) || '%'
    ) DESC
    LIMIT 1;
    
    RETURN COALESCE(result, 'PHONE');
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- COMPLETE SKU PARSING FUNCTION
-- ========================================

CREATE OR REPLACE FUNCTION parse_sku_complete(sku_code TEXT)
RETURNS TABLE(
    brand TEXT,
    model TEXT,
    capacity TEXT,
    color TEXT,
    carrier TEXT,
    postfix TEXT,
    device_type TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        get_brand_from_sku(sku_code) as brand,
        get_model_from_sku(sku_code, get_brand_from_sku(sku_code)) as model,
        get_capacity_from_sku(sku_code) as capacity,
        get_color_from_sku(sku_code) as color,
        get_carrier_from_sku(sku_code) as carrier,
        get_postfix_from_sku(sku_code) as postfix,
        get_device_type_from_sku(sku_code) as device_type;
END;
$$ LANGUAGE plpgsql;

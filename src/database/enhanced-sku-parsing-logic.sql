-- ========================================
-- ENHANCED SKU PARSING LOGIC
-- Fixes contextual field positioning and prevents incorrect postfix assignment
-- ========================================

-- Drop existing functions to recreate with enhanced logic
DROP FUNCTION IF EXISTS get_carrier_from_sku(TEXT);
DROP FUNCTION IF EXISTS get_postfix_from_sku(TEXT);
DROP FUNCTION IF EXISTS parse_sku_complete(TEXT);

-- ========================================
-- ENHANCED CARRIER PARSING FUNCTION
-- ========================================

CREATE OR REPLACE FUNCTION get_carrier_from_sku(sku_code TEXT)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
    segments TEXT[];
    last_segment TEXT;
    carrier_found TEXT;
BEGIN
    -- Split SKU into segments for contextual analysis
    segments := string_to_array(replace(replace(sku_code, '-', '|'), '_', '|'), '|');
    last_segment := segments[array_length(segments, 1)];
    
    -- First, try to find carrier patterns in the SKU
    SELECT carrier_name INTO carrier_found
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
    
    -- If we found a carrier, check if it's the last segment
    IF carrier_found IS NOT NULL THEN
        -- Check if the last segment matches a carrier pattern
        IF EXISTS (
            SELECT 1 FROM sku_carrier_reference
            WHERE is_active = true
            AND UPPER(last_segment) = ANY(
                SELECT UPPER(unnest(sku_patterns))
                FROM sku_carrier_reference
                WHERE carrier_name = carrier_found
            )
        ) THEN
            -- Last segment is a carrier, return it
            result := carrier_found;
        ELSE
            -- Carrier found but not in last position, check if it's UNLOCKED
            IF UPPER(carrier_found) = 'UNLOCKED' THEN
                -- UNLOCKED should be treated as empty (no carrier)
                result := '';
            ELSE
                -- Other carriers found in middle positions
                result := carrier_found;
            END IF;
        END IF;
    ELSE
        -- No carrier found, check if last segment could be a carrier
        IF EXISTS (
            SELECT 1 FROM sku_carrier_reference
            WHERE is_active = true
            AND UPPER(last_segment) = ANY(
                SELECT UPPER(unnest(sku_patterns))
                FROM sku_carrier_reference
                WHERE carrier_name != 'UNLOCKED'
            )
        ) THEN
            -- Last segment is a carrier (not UNLOCKED)
            SELECT carrier_name INTO result
            FROM sku_carrier_reference
            WHERE is_active = true
            AND UPPER(last_segment) = ANY(
                SELECT UPPER(unnest(sku_patterns))
                FROM sku_carrier_reference
                WHERE carrier_name != 'UNLOCKED'
            )
            LIMIT 1;
        ELSE
            -- No carrier found, return empty
            result := '';
        END IF;
    END IF;
    
    RETURN COALESCE(result, '');
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- ENHANCED POSTFIX PARSING FUNCTION
-- ========================================

CREATE OR REPLACE FUNCTION get_postfix_from_sku(sku_code TEXT)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
    segments TEXT[];
    last_segment TEXT;
    carrier_found TEXT;
    color_found TEXT;
    postfix_found TEXT;
BEGIN
    -- Split SKU into segments for contextual analysis
    segments := string_to_array(replace(replace(sku_code, '-', '|'), '_', '|'), '|');
    last_segment := segments[array_length(segments, 1)];
    
    -- First, check if the last segment is a carrier
    SELECT carrier_name INTO carrier_found
    FROM sku_carrier_reference
    WHERE is_active = true
    AND UPPER(last_segment) = ANY(
        SELECT UPPER(unnest(sku_patterns))
        FROM sku_carrier_reference
        WHERE carrier_name != 'UNLOCKED'
    )
    LIMIT 1;
    
    -- If last segment is a carrier, no postfix
    IF carrier_found IS NOT NULL THEN
        RETURN '';
    END IF;
    
    -- Check if the last segment is a color
    SELECT color_name INTO color_found
    FROM sku_color_reference
    WHERE is_active = true
    AND UPPER(last_segment) = ANY(
        SELECT UPPER(unnest(sku_patterns))
        FROM sku_color_reference
    )
    LIMIT 1;
    
    -- If last segment is a color, no postfix
    IF color_found IS NOT NULL THEN
        RETURN '';
    END IF;
    
    -- Now check for postfix patterns
    SELECT postfix_name INTO postfix_found
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
    
    -- If we found a postfix, check if it's the last segment
    IF postfix_found IS NOT NULL THEN
        -- Check if the last segment matches a postfix pattern
        IF EXISTS (
            SELECT 1 FROM sku_postfix_reference
            WHERE is_active = true
            AND UPPER(last_segment) = ANY(
                SELECT UPPER(unnest(sku_patterns))
                FROM sku_postfix_reference
                WHERE postfix_name = postfix_found
            )
        ) THEN
            -- Last segment is a postfix, return it
            result := postfix_found;
        ELSE
            -- Postfix found but not in last position, return empty
            result := '';
        END IF;
    ELSE
        -- No postfix found
        result := '';
    END IF;
    
    RETURN COALESCE(result, '');
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- ENHANCED COMPLETE SKU PARSING FUNCTION
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
DECLARE
    brand_result TEXT;
    model_result TEXT;
    capacity_result TEXT;
    color_result TEXT;
    carrier_result TEXT;
    postfix_result TEXT;
    device_type_result TEXT;
BEGIN
    -- Get brand first
    brand_result := get_brand_from_sku(sku_code);
    
    -- Get model with brand context
    model_result := get_model_from_sku(sku_code, brand_result);
    
    -- Get capacity
    capacity_result := get_capacity_from_sku(sku_code);
    
    -- Get color
    color_result := get_color_from_sku(sku_code);
    
    -- Get carrier with enhanced logic
    carrier_result := get_carrier_from_sku(sku_code);
    
    -- Get postfix with enhanced logic
    postfix_result := get_postfix_from_sku(sku_code);
    
    -- Get device type
    device_type_result := get_device_type_from_sku(sku_code);
    
    -- Return results
    RETURN QUERY SELECT 
        brand_result,
        model_result,
        capacity_result,
        color_result,
        carrier_result,
        postfix_result,
        device_type_result;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- TEST FUNCTIONS FOR VALIDATION
-- ========================================

-- Function to test SKU parsing with examples
CREATE OR REPLACE FUNCTION test_sku_parsing()
RETURNS TABLE(
    sku_code TEXT,
    brand TEXT,
    model TEXT,
    capacity TEXT,
    color TEXT,
    carrier TEXT,
    postfix TEXT,
    device_type TEXT
) AS $$
BEGIN
    -- Test cases
    RETURN QUERY
    SELECT * FROM parse_sku_complete('S23-ULTRA-256-BLK')        -- Should have no postfix (ends with color)
    UNION ALL
    SELECT * FROM parse_sku_complete('S23-ULTRA-256-BLK-TMO')    -- Should have TMO carrier, no postfix
    UNION ALL
    SELECT * FROM parse_sku_complete('S23-ULTRA-256-BLK-VG')     -- Should have VG postfix
    UNION ALL
    SELECT * FROM parse_sku_complete('S23-ULTRA-256-BLK-TMO-VG') -- Should have TMO carrier and VG postfix
    UNION ALL
    SELECT * FROM parse_sku_complete('PIXEL-7-128-WHT-UNLOCKED') -- Should have empty carrier (UNLOCKED)
    UNION ALL
    SELECT * FROM parse_sku_complete('PIXEL-7-128-WHT-ATT')      -- Should have ATT carrier
    UNION ALL
    SELECT * FROM parse_sku_complete('IP-15-256-BLK-NEW')        -- Should have NEW postfix
    UNION ALL
    SELECT * FROM parse_sku_complete('IP-15-256-BLK-ATT-NEW');   -- Should have ATT carrier and NEW postfix
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- UPDATE CARRIER REFERENCE DATA
-- ========================================

-- Add more T-Mobile variations
INSERT INTO sku_carrier_reference (carrier_name, carrier_code, sku_patterns, description) VALUES
('T-MOBILE', 'TMO', ARRAY['TMO', 'T-MOBILE', 'TMOBILE', 'T-MO', 'TM'], 'T-Mobile carrier variations')
ON CONFLICT (carrier_code) DO UPDATE SET
    sku_patterns = EXCLUDED.sku_patterns,
    description = EXCLUDED.description;

-- Update existing T-Mobile entry
UPDATE sku_carrier_reference 
SET sku_patterns = ARRAY['TMO', 'T-MOBILE', 'TMOBILE', 'T-MO', 'TM']
WHERE carrier_code = 'T-MOBILE';

-- Add more AT&T variations
UPDATE sku_carrier_reference 
SET sku_patterns = ARRAY['ATT', 'AT&T', 'AT&T', 'ATANDT']
WHERE carrier_code = 'ATT';

-- Add more Verizon variations
UPDATE sku_carrier_reference 
SET sku_patterns = ARRAY['VERIZON', 'VZW', 'VRZ', 'VER']
WHERE carrier_code = 'VERIZON';

-- ========================================
-- VALIDATION QUERIES
-- ========================================

-- Test the enhanced parsing logic
-- SELECT * FROM test_sku_parsing();

-- Check specific examples
-- SELECT * FROM parse_sku_complete('S23-ULTRA-256-BLK');        -- Should return: SAMSUNG, Galaxy S23 Ultra, 256GB, BLACK, '', '', PHONE
-- SELECT * FROM parse_sku_complete('S23-ULTRA-256-BLK-TMO');    -- Should return: SAMSUNG, Galaxy S23 Ultra, 256GB, BLACK, T-MOBILE, '', PHONE
-- SELECT * FROM parse_sku_complete('S23-ULTRA-256-BLK-VG');     -- Should return: SAMSUNG, Galaxy S23 Ultra, 256GB, BLACK, '', Very Good, PHONE
-- SELECT * FROM parse_sku_complete('S23-ULTRA-256-BLK-TMO-VG'); -- Should return: SAMSUNG, Galaxy S23 Ultra, 256GB, BLACK, T-MOBILE, Very Good, PHONE

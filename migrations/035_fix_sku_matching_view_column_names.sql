-- Fix SKU Matching View - Correct column names to match actual table structure
-- This migration fixes the column name mismatch in sku_matching_view
-- ENHANCED: Improved capacity and color handling for better SKU matching

-- 1. Drop existing views first
DROP VIEW IF EXISTS sku_matching_summary CASCADE;
DROP VIEW IF EXISTS manual_review_sku_items CASCADE;
DROP VIEW IF EXISTS no_match_sku_items CASCADE;
DROP VIEW IF EXISTS successful_sku_matches CASCADE;
DROP VIEW IF EXISTS pending_sku_matches CASCADE;
DROP VIEW IF EXISTS sku_matching_view CASCADE;

-- 2. Create the enhanced main SKU matching view with improved capacity/color handling
CREATE VIEW sku_matching_view AS
SELECT 
    p.imei,
    
    -- Original SKU (from product table - generated during data intake)
    p.sku as original_sku,
    
    -- Matched SKU (from sku_matching_results table - from Google Sheets master)
    smr.matched_sku as sku_matched,
    
    -- SKU matching details (essential for matching logic)
    smr.match_score,
    smr.match_method,
    smr.match_status,
    smr.match_notes,
    smr.processed_at as match_processed_at,  -- FIXED: alias to match_processed_at for consistency
    
    -- Device information (only fields needed for SKU generation/matching)
    p.brand,
    i.model,
    i.carrier,
    i.capacity,
    i.color,
    
    -- ENHANCED: Normalized capacity for better matching
    CASE 
        WHEN i.capacity IS NULL THEN NULL
        WHEN i.capacity ~ '^\d+$' THEN i.capacity  -- Already numeric
        WHEN i.capacity ~ '^\d+\s*[GT]B?$' THEN 
            REGEXP_REPLACE(i.capacity, '[^0-9]', '', 'g')  -- Extract numbers from "256GB", "1TB"
        WHEN i.capacity ~ '^\d+\s*MB$' THEN 
            (REGEXP_REPLACE(i.capacity, '[^0-9]', '', 'g')::integer / 1024)::text  -- Convert MB to GB
        ELSE i.capacity
    END as normalized_capacity,
    
    -- ENHANCED: Normalized color for better matching
    CASE 
        WHEN i.color IS NULL THEN NULL
        WHEN UPPER(i.color) LIKE '%BLK%' OR UPPER(i.color) LIKE '%BLACK%' THEN 'BLACK'
        WHEN UPPER(i.color) LIKE '%BLU%' OR UPPER(i.color) LIKE '%BLUE%' THEN 'BLUE'
        WHEN UPPER(i.color) LIKE '%WHT%' OR UPPER(i.color) LIKE '%WHITE%' THEN 'WHITE'
        WHEN UPPER(i.color) LIKE '%RED%' THEN 'RED'
        WHEN UPPER(i.color) LIKE '%GRN%' OR UPPER(i.color) LIKE '%GREEN%' THEN 'GREEN'
        WHEN UPPER(i.color) LIKE '%PUR%' OR UPPER(i.color) LIKE '%PURPLE%' THEN 'PURPLE'
        WHEN UPPER(i.color) LIKE '%PNK%' OR UPPER(i.color) LIKE '%PINK%' THEN 'PINK'
        WHEN UPPER(i.color) LIKE '%GLD%' OR UPPER(i.color) LIKE '%GOLD%' THEN 'GOLD'
        WHEN UPPER(i.color) LIKE '%SLV%' OR UPPER(i.color) LIKE '%SILVER%' THEN 'SILVER'
        WHEN UPPER(i.color) LIKE '%GRY%' OR UPPER(i.color) LIKE '%GRAY%' OR UPPER(i.color) LIKE '%GREY%' THEN 'GRAY'
        WHEN UPPER(i.color) LIKE '%HAZ%' OR UPPER(i.color) LIKE '%HAZEL%' THEN 'HAZEL'
        -- Handle Phantom colors specifically
        WHEN UPPER(i.color) LIKE '%PHANTOM%' THEN
            CASE 
                WHEN UPPER(i.color) LIKE '%PHANTOM BLACK%' OR UPPER(i.color) LIKE '%PHANTOMBLACK%' THEN 'BLACK'
                WHEN UPPER(i.color) LIKE '%PHANTOM GREEN%' OR UPPER(i.color) LIKE '%PHANTOMGREEN%' THEN 'GREEN'
                WHEN UPPER(i.color) LIKE '%PHANTOM BLUE%' OR UPPER(i.color) LIKE '%PHANTOMBLUE%' THEN 'BLUE'
                WHEN UPPER(i.color) LIKE '%PHANTOM WHITE%' OR UPPER(i.color) LIKE '%PHANTOMWHITE%' THEN 'WHITE'
                WHEN UPPER(i.color) LIKE '%PHANTOM RED%' OR UPPER(i.color) LIKE '%PHANTOMRED%' THEN 'RED'
                ELSE 'UNKNOWN'
            END
        ELSE UPPER(TRIM(i.color))
    END as normalized_color,
    
    -- CRITICAL: Device test notes for carrier override logic
    dt.notes as device_notes,
    
    -- ENHANCED: Computed fields for matching logic with better capacity/color handling
    CASE 
        WHEN i.model IS NOT NULL AND i.capacity IS NOT NULL AND i.color IS NOT NULL 
        THEN 'complete'
        WHEN i.model IS NOT NULL AND i.capacity IS NOT NULL 
        THEN 'partial'
        ELSE 'incomplete'
    END as data_completeness,
    
    -- ENHANCED: Capacity validation status
    CASE 
        WHEN i.capacity IS NULL THEN 'missing'
        WHEN i.capacity ~ '^\d+$' THEN 'valid_numeric'
        WHEN i.capacity ~ '^\d+\s*[GT]B?$' THEN 'valid_storage'
        WHEN i.capacity ~ '^\d+\s*MB$' THEN 'valid_mb'
        ELSE 'invalid_format'
    END as capacity_status,
    
    -- ENHANCED: Color validation status
    CASE 
        WHEN i.color IS NULL THEN 'missing'
        WHEN i.normalized_color != 'UNKNOWN' THEN 'valid'
        ELSE 'unknown_format'
    END as color_status,
    
    -- Last activity timestamp (for prioritization)
    GREATEST(p.date_in, COALESCE(mh.movement_date, p.date_in)) as last_activity
    
FROM product p
LEFT JOIN item i ON p.imei = i.imei
LEFT JOIN device_test dt ON p.imei = dt.imei  -- CRITICAL: Restored for notes
LEFT JOIN movement_history mh ON p.imei = mh.imei
LEFT JOIN sku_matching_results smr ON p.imei = smr.imei
WHERE mh.movement_date = (
    SELECT MAX(movement_date) 
    FROM movement_history mh2 
    WHERE mh2.imei = p.imei
) OR mh.movement_date IS NULL;

-- 3. Create a minimal view for pending SKU matches (only matching fields)
CREATE VIEW pending_sku_matches AS
SELECT 
    imei,
    original_sku,
    brand,
    model,
    capacity,
    normalized_capacity,
    color,
    normalized_color,
    carrier,
    device_notes,
    data_completeness,
    capacity_status,
    color_status,
    last_activity
FROM sku_matching_view
WHERE match_status IS NULL OR match_status = 'pending'
ORDER BY last_activity DESC;

-- 4. Create a view for successful matches (minimal fields)
CREATE VIEW successful_sku_matches AS
SELECT 
    imei,
    original_sku,
    sku_matched,
    match_score,
    match_method,
    brand,
    model,
    capacity,
    normalized_capacity,
    color,
    normalized_color,
    carrier,
    device_notes,
    match_processed_at
FROM sku_matching_view
WHERE match_status = 'matched'
ORDER BY match_processed_at DESC;

-- 5. Create a view for no-match items (minimal fields)
CREATE VIEW no_match_sku_items AS
SELECT 
    imei,
    original_sku,
    brand,
    model,
    capacity,
    normalized_capacity,
    color,
    normalized_color,
    carrier,
    device_notes,
    match_score,
    match_method,
    match_notes,
    data_completeness,
    capacity_status,
    color_status,
    last_activity
FROM sku_matching_view
WHERE match_status = 'no_match' OR match_score < 0.5
ORDER BY last_activity DESC;

-- 6. Create a view for manual review items (minimal fields)
CREATE VIEW manual_review_sku_items AS
SELECT 
    imei,
    original_sku,
    brand,
    model,
    capacity,
    normalized_capacity,
    color,
    normalized_color,
    carrier,
    device_notes,
    match_score,
    match_method,
    match_notes,
    data_completeness,
    capacity_status,
    color_status,
    last_activity
FROM sku_matching_view
WHERE match_status = 'manual_review' OR (match_score >= 0.5 AND match_score < 0.8)
ORDER BY match_score DESC, last_activity DESC;

-- 7. Create a summary view for reporting with capacity/color insights
CREATE VIEW sku_matching_summary AS
SELECT 
    COUNT(*) as total_devices,
    COUNT(CASE WHEN match_status = 'matched' THEN 1 END) as matched_devices,
    COUNT(CASE WHEN match_status = 'no_match' THEN 1 END) as no_match_devices,
    COUNT(CASE WHEN match_status = 'manual_review' THEN 1 END) as manual_review_devices,
    COUNT(CASE WHEN match_status IS NULL THEN 1 END) as pending_devices,
    ROUND(AVG(CASE WHEN match_score IS NOT NULL THEN match_score END), 3) as avg_match_score,
    COUNT(CASE WHEN match_score >= 0.9 THEN 1 END) as high_confidence_matches,
    COUNT(CASE WHEN match_score >= 0.7 AND match_score < 0.9 THEN 1 END) as medium_confidence_matches,
    COUNT(CASE WHEN match_score < 0.7 THEN 1 END) as low_confidence_matches,
    -- ENHANCED: Capacity and color statistics
    COUNT(CASE WHEN capacity_status = 'valid_numeric' THEN 1 END) as valid_numeric_capacity,
    COUNT(CASE WHEN capacity_status = 'valid_storage' THEN 1 END) as valid_storage_capacity,
    COUNT(CASE WHEN capacity_status = 'valid_mb' THEN 1 END) as valid_mb_capacity,
    COUNT(CASE WHEN capacity_status = 'invalid_format' THEN 1 END) as invalid_capacity_format,
    COUNT(CASE WHEN color_status = 'valid' THEN 1 END) as valid_colors,
    COUNT(CASE WHEN color_status = 'unknown_format' THEN 1 END) as unknown_color_formats
FROM sku_matching_view;

-- Add comments for documentation
COMMENT ON VIEW sku_matching_view IS 'Enhanced SKU matching view with improved capacity and color normalization for better matching accuracy';
COMMENT ON COLUMN sku_matching_view.normalized_capacity IS 'Standardized capacity value (GB) for consistent SKU matching';
COMMENT ON COLUMN sku_matching_view.normalized_color IS 'Standardized color name for consistent SKU matching';
COMMENT ON COLUMN sku_matching_view.capacity_status IS 'Validation status of capacity field (missing, valid_numeric, valid_storage, valid_mb, invalid_format)';
COMMENT ON COLUMN sku_matching_view.color_status IS 'Validation status of color field (missing, valid, unknown_format)';
COMMENT ON COLUMN sku_matching_view.device_notes IS 'Notes from device_test table - critical for carrier override logic (CARRIER LOCKED/UNLOCKED)';
COMMENT ON COLUMN sku_matching_view.match_processed_at IS 'Timestamp when SKU matching was processed (from sku_matching_results.processed_at)';
